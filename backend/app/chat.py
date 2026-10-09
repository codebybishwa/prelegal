"""AI chat that works out which agreement the user needs and fills in its fields.

Each turn is stateless: the client sends the conversation so far, the selected document
(if any) and its current values, and gets back the assistant's reply plus the document
and values after the turn. The LLM answers with JSON matching the schema from
``build_turn_schema`` (Structured Outputs); the server owns document switching and
validates every value against the document definitions in documents.json.
"""

import json
import logging
from datetime import date
from typing import Any, Literal

import litellm
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.config import Settings
from app.documents import MAX_TERM_YEARS, NO_TERM, DocumentDef, Registry, Values

logger = logging.getLogger(__name__)

# Free providers can stall; fail fast with a clear error instead of hanging the chat.
LLM_TIMEOUT_SECONDS = 60


class LlmUnavailableError(Exception):
    """The configured LLM could not be used (missing key, paid model, provider down)."""


class LlmResponseError(Exception):
    """The LLM answered, but not with a usable structured response."""


class UnknownDocumentError(Exception):
    """The request names a document that isn't in documents.json."""


# ---------- API models ----------


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    # Generous limits: assistant replies are echoed back as history and aren't length-capped.
    content: str = Field(min_length=1, max_length=20_000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    documentId: str | None = None
    # The selected document's current values; ignored when no document is selected.
    values: dict[str, str] = Field(default_factory=dict, max_length=200)
    # The saved draft this conversation continues; null until the first save.
    draftId: int | None = None


class ChatResponse(BaseModel):
    reply: str
    documentId: str | None
    # Every field of the selected document after this turn (empty when none is selected).
    values: Values
    # The draft this turn was saved to; null while no document is selected.
    draftId: int | None = None


# ---------- LLM output models ----------


class FieldUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    value: str


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: str
    document: str | None = Field(None, description="id of the document to select or switch to; null = no change")
    updates: list[FieldUpdate] = []


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


def build_turn_schema(registry: Registry) -> dict[str, Any]:
    """The Turn schema, with document ids and field keys constrained to the registry's."""
    schema = _strict(Turn.model_json_schema())
    document = next(option for option in schema["properties"]["document"]["anyOf"] if option["type"] == "string")
    document["enum"] = registry.document_ids
    schema["$defs"]["FieldUpdate"]["properties"]["key"]["enum"] = registry.all_keys
    return schema


# ---------- Prompt ----------

SYSTEM_PROMPT = """\
You are PreLegal's assistant. You guide the user through drafting a legal agreement \
from Common Paper's standard templates by chatting with them, and you fill in the \
agreement's fields from their answers.

These are the only documents you can draft (id: name - when to use it. Field keys). \
Every document also has the party fields party1.name, party1.title, party1.company, \
party1.noticeAddress and the same for party2.
{catalog}

Choosing the document:
- If no document is selected, find out what the user wants to draft. When their \
request clearly matches a supported document, set "document" to its id and start \
asking about its fields.
- If they ask for something that isn't supported (for example an employment contract \
or a lease), say plainly that PreLegal can't draft that, suggest the closest supported \
document and ask whether they want it instead. Leave "document" null until they agree. \
If nothing is close, say so and briefly list what you can draft.
- If the user wants to switch to another supported document, set "document" to its id, \
put any new details from their message in "updates" using the new document's field keys \
(listed above), and tell them that answers which also apply to the new document are kept.
- Otherwise set "document" to null, which means no change.

{current}

How to behave:
- Be friendly and concise. Ask about one or two missing fields at a time, starting \
with the parties, then the fields in the order listed.
- Write "reply" as plain text for a chat bubble: no markdown, bold or headings.
- Fill a field as soon as the user states its value, including details given in the \
same message that picks the document; don't ask them to confirm what they just said. \
Never invent names, companies or addresses. Optional fields may stay blank if the user \
has nothing to add.
- In "updates", list only the fields that change this turn as key/value pairs, using \
the keys of the selected document (or of the document you select or switch to this \
turn). Use an empty list when nothing changes or no document is selected, and "" to \
clear a field.
- Dates are yyyy-mm-dd; convert relative dates such as "today" or "next Monday". \
Today is {today}.
- When every required field is filled, say the document is complete and that they can \
review it and use "Download PDF". Keep helping if they want changes.
- You draft documents; you do not give legal advice. Suggest a lawyer for legal questions.
"""

_FORMATS = {
    "date": "yyyy-mm-dd",
    "term": f'whole years from 1 to {MAX_TERM_YEARS}, or "{NO_TERM}" for "{{none_label}}"',
}


def _describe_document(registry: Registry, doc: DocumentDef | None, values: Values) -> str:
    if doc is None:
        return "No document is selected yet."
    lines = [
        f"Selected document: {doc.name} (id {doc.id}). "
        f"party1 is the {doc.parties[0]} and party2 is the {doc.parties[1]}.",
        "",
        "Its fields (key: label - description):",
    ]
    for field in registry.fields_of(doc):
        line = f"- {field.key}: {field.label} - {field.description}"
        if field.type in _FORMATS:
            line += f". Value: {_FORMATS[field.type].format(none_label=field.noneLabel)}"
        if field.optional:
            line += " (optional)"
        lines.append(line)
    lines += ["", "Current values (JSON):", json.dumps(values, indent=2, ensure_ascii=False)]
    return "\n".join(lines)


def build_system_prompt(registry: Registry, doc: DocumentDef | None, values: Values, today: date) -> str:
    catalog = "\n".join(
        f"- {d.id}: {d.name} - {d.description} Fields: {', '.join(d.field_keys)}" for d in registry.documents
    )
    return SYSTEM_PROMPT.format(
        catalog=catalog,
        current=_describe_document(registry, doc, values),
        today=today.isoformat(),
    )


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


def _call_llm(messages: list[dict[str, str]], schema: dict[str, Any], settings: Settings) -> Turn:
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
                "json_schema": {"name": "document_chat_turn", "strict": True, "schema": schema},
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
    return _parse_turn(response.choices[0].message.content)


def chat_turn(
    request: ChatRequest, settings: Settings, registry: Registry, today: date | None = None
) -> ChatResponse:
    doc = None
    if request.documentId is not None:
        doc = registry.document(request.documentId)
        if doc is None:
            raise UnknownDocumentError(f"Unknown document '{request.documentId}'.")
    values = registry.clean(doc, request.values) if doc else {}

    if not settings.openrouter_api_key:
        raise LlmUnavailableError("The AI assistant is not configured: OPEN_ROUTER_API_KEY is not set.")
    ensure_free_model(settings.llm_model)

    messages = [
        {"role": "system", "content": build_system_prompt(registry, doc, values, today or date.today())},
        *(m.model_dump() for m in request.messages),
    ]
    turn = _call_llm(messages, build_turn_schema(registry), settings)

    # An unknown id from the LLM is ignored rather than failing the whole turn.
    chosen = registry.document(turn.document) if turn.document else None
    if chosen and chosen != doc:
        values = registry.switch(values, chosen)
        doc = chosen
    if doc:
        values = registry.apply(doc, values, ((u.key, u.value) for u in turn.updates))

    return ChatResponse(reply=turn.reply.strip(), documentId=doc.id if doc else None, values=values)
