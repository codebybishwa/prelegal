"""AI chat that interviews the user and fills in the Mutual NDA cover page.

Each turn is stateless: the client sends the conversation so far plus the current NDA
values, and gets back the assistant's reply and the fields it changed. The LLM answers
with JSON matching ``TURN_SCHEMA`` (Structured Outputs), which is mapped onto the
frontend's ``NdaData`` shape by ``to_nda_updates``.
"""

import logging
from datetime import date
from typing import Any, Literal

import litellm
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings

logger = logging.getLogger(__name__)

MAX_TERM_YEARS = 10
# Free providers can stall; fail fast with a clear error instead of hanging the chat.
LLM_TIMEOUT_SECONDS = 60


class LlmUnavailableError(Exception):
    """The configured LLM could not be used (missing key, paid model, provider down)."""


class LlmResponseError(Exception):
    """The LLM answered, but not with a usable structured response."""


# ---------- API models (mirror frontend/lib/nda.ts) ----------


class Party(BaseModel):
    name: str = ""
    title: str = ""
    company: str = ""
    noticeAddress: str = ""


class NdaData(BaseModel):
    purpose: str = ""
    effectiveDate: str = ""
    mndaTermYears: int | None = 1
    confidentialityYears: int | None = 1
    governingLaw: str = ""
    jurisdiction: str = ""
    modifications: str = ""
    party1: Party = Party()
    party2: Party = Party()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    # Generous limits: assistant replies are echoed back as history and aren't length-capped.
    content: str = Field(min_length=1, max_length=20_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    nda: NdaData


class ChatResponse(BaseModel):
    reply: str
    # Partial NdaData: only the keys that changed. A null term means open-ended.
    updates: dict[str, Any]


# ---------- LLM output models (null = leave unchanged) ----------


class PartyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    title: str | None = None
    company: str | None = None
    noticeAddress: str | None = None


class NdaUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    purpose: str | None = None
    effectiveDate: str | None = Field(None, description="ISO date, yyyy-mm-dd")
    mndaTermYears: int | None = Field(None, description=f"1-{MAX_TERM_YEARS} years from the Effective Date")
    mndaTermOpenEnded: bool | None = Field(None, description="true if the MNDA continues until terminated")
    confidentialityYears: int | None = Field(None, description=f"1-{MAX_TERM_YEARS} years from the Effective Date")
    confidentialityPerpetual: bool | None = Field(None, description="true if confidentiality lasts in perpetuity")
    governingLaw: str | None = None
    jurisdiction: str | None = None
    modifications: str | None = None
    party1: PartyUpdate | None = None
    party2: PartyUpdate | None = None


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: str
    updates: NdaUpdate = NdaUpdate()


def _strict(schema: dict[str, Any]) -> dict[str, Any]:
    """Adapt a Pydantic schema to Structured Outputs strict mode: every property required
    (nullable instead of optional) and no unsupported "default"/"title" keywords."""
    if isinstance(schema, dict):
        schema.pop("default", None)
        if isinstance(schema.get("title"), str):
            schema.pop("title")
        if schema.get("type") == "object" and "properties" in schema:
            schema["required"] = list(schema["properties"])
        for value in schema.values():
            _strict(value)
    elif isinstance(schema, list):
        for item in schema:
            _strict(item)
    return schema


TURN_SCHEMA = _strict(Turn.model_json_schema())


# ---------- Prompt ----------

SYSTEM_PROMPT = """\
You are PreLegal's assistant. You help the user complete a Common Paper Mutual \
Non-Disclosure Agreement (MNDA) by chatting with them, and you fill in the cover \
page fields from their answers.

Cover page fields:
- purpose: how Confidential Information may be used.
- effectiveDate: the date the MNDA starts, as yyyy-mm-dd. Today is {today}.
- MNDA term: either mndaTermYears (whole number, 1-{max_years}) years from the \
Effective Date, or mndaTermOpenEnded = true (continues until terminated).
- Term of confidentiality: either confidentialityYears (whole number, 1-{max_years}) \
years from the Effective Date, or confidentialityPerpetual = true (in perpetuity).
- governingLaw: the US state whose laws govern, e.g. "Delaware".
- jurisdiction: city or county and state of the courts, e.g. "courts located in New Castle, DE".
- modifications: any changes to the standard MNDA terms (often none).
- party1 and party2: each party's signatory name, title, company and notice address \
(email or postal).

How to behave:
- Be friendly and concise. Ask about one or two missing fields at a time, starting \
with the parties and purpose.
- Write "reply" as plain text for a chat bubble: no markdown, bold or headings.
- Only fill a field when the user has stated or clearly confirmed its value. Never \
invent names, companies or addresses.
- In "updates", set only the fields that change this turn; use null for everything \
else. Use null for a whole party when none of its fields change.
- Convert relative dates (e.g. "today", "next Monday") to yyyy-mm-dd.
- When every field is filled, say the NDA is complete and that they can review it \
and use "Download PDF". Keep helping if they want changes.
- You draft documents; you do not give legal advice. Suggest a lawyer for legal questions.

Current cover page values (JSON):
{nda}
"""


def build_system_prompt(nda: NdaData, today: date) -> str:
    return SYSTEM_PROMPT.format(
        today=today.isoformat(),
        max_years=MAX_TERM_YEARS,
        nda=nda.model_dump_json(indent=2),
    )


# ---------- Mapping LLM output to NdaData updates ----------

_UNCHANGED = object()


def _term(years: int | None, open_ended: bool | None) -> object:
    """Map the LLM's two term fields to NdaData's convention: years, or None for open-ended."""
    if open_ended:
        return None
    if years is not None and 1 <= years <= MAX_TERM_YEARS:
        return years
    return _UNCHANGED


def _is_iso_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return len(value) == 10


def to_nda_updates(update: NdaUpdate) -> dict[str, Any]:
    """The changed fields as a partial NdaData. Invalid values from the LLM are dropped."""
    updates: dict[str, Any] = {}

    for key in ("purpose", "governingLaw", "jurisdiction", "modifications"):
        value = getattr(update, key)
        if value is not None:
            updates[key] = value.strip()

    if update.effectiveDate is not None and _is_iso_date(update.effectiveDate.strip()):
        updates["effectiveDate"] = update.effectiveDate.strip()

    for key, years, open_ended in (
        ("mndaTermYears", update.mndaTermYears, update.mndaTermOpenEnded),
        ("confidentialityYears", update.confidentialityYears, update.confidentialityPerpetual),
    ):
        term = _term(years, open_ended)
        if term is not _UNCHANGED:
            updates[key] = term

    for key in ("party1", "party2"):
        party: PartyUpdate | None = getattr(update, key)
        if party is not None:
            changed = {k: v.strip() for k, v in party.model_dump().items() if v is not None}
            if changed:
                updates[key] = changed

    return updates


# ---------- LLM call ----------


def ensure_free_model(model: str) -> None:
    """Cost guardrail: only OpenRouter ':free' models may be called, so nothing is ever billed."""
    if not model.endswith(":free"):
        raise LlmUnavailableError(f"Refusing to call non-free model '{model}'. Configure a ':free' OpenRouter model.")


UNEXPECTED_RESPONSE = "The AI assistant returned an unexpected response. Please try again."


def _parse_turn(content: str | None) -> Turn:
    text = (content or "").strip()
    # Some providers wrap JSON in a markdown code fence despite the response format.
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        turn = Turn.model_validate_json(text)
    except ValidationError as exc:
        raise LlmResponseError(UNEXPECTED_RESPONSE) from exc
    # An empty reply would be stored as an empty chat message and break every later turn.
    if not turn.reply.strip():
        raise LlmResponseError(UNEXPECTED_RESPONSE)
    return turn


def chat_turn(request: ChatRequest, settings: Settings, today: date | None = None) -> ChatResponse:
    if not settings.openrouter_api_key:
        raise LlmUnavailableError("The AI assistant is not configured: OPEN_ROUTER_API_KEY is not set.")
    ensure_free_model(settings.llm_model)

    messages = [
        {"role": "system", "content": build_system_prompt(request.nda, today or date.today())},
        *(m.model_dump() for m in request.messages),
    ]
    try:
        # No fallbacks: if the free model is unavailable we fail rather than pay for another.
        response = litellm.completion(
            model=settings.llm_model,
            api_key=settings.openrouter_api_key,
            messages=messages,
            timeout=LLM_TIMEOUT_SECONDS,
            num_retries=0,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "nda_chat_turn", "strict": True, "schema": TURN_SCHEMA},
            },
        )
    except litellm.NotFoundError as exc:
        logger.exception("LLM model %s not found", settings.llm_model)
        raise LlmUnavailableError(
            f"The configured AI model '{settings.llm_model}' is not available for free on OpenRouter. "
            "Set PRELEGAL_LLM_MODEL to another ':free' model."
        ) from exc
    except litellm.RateLimitError as exc:
        raise LlmUnavailableError("The free AI model is busy right now. Please wait a moment and try again.") from exc
    except Exception as exc:  # LiteLLM wraps provider failures in many exception types.
        logger.exception("LLM call to %s failed", settings.llm_model)
        raise LlmUnavailableError("The AI assistant is unavailable right now. Please try again shortly.") from exc

    if not response.choices:
        raise LlmResponseError(UNEXPECTED_RESPONSE)
    turn = _parse_turn(response.choices[0].message.content)
    return ChatResponse(reply=turn.reply.strip(), updates=to_nda_updates(turn.updates))
