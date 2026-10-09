"""The supported legal documents and their fields, loaded from the repo's documents.json.

documents.json is shared with the frontend: the backend uses it to prompt the LLM and to
validate its answers, the frontend to render each document's cover page. A document's
values are plain strings keyed by field key, with party fields expanded per party
("party1.name", "party2.company", ...) so they carry over when the user switches documents.
"""

import json
import re
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Literal

from pydantic import BaseModel, ConfigDict, Field, PrivateAttr, model_validator

PARTY_IDS = ("party1", "party2")
MAX_TERM_YEARS = 10
# A "term" field's value when it has no fixed length (e.g. "In perpetuity").
NO_TERM = "none"
MAX_TEXT_LENGTH = 2_000

Values = dict[str, str]


class FieldDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = ""  # Set from the "fields" map key, or the party-prefixed key.
    label: str
    # text: free text; date: ISO yyyy-mm-dd; term: whole years (1-MAX_TERM_YEARS) or NO_TERM.
    type: Literal["text", "date", "term"]
    description: str
    default: str = ""
    optional: bool = False
    noneLabel: str | None = None  # What NO_TERM means for a "term" field.
    covers: list[str] = []  # Other template terms this field supplies besides its label.


class Templates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    terms: str
    coverPage: str | None = None  # A fillable cover page template; otherwise one is generated.


class DocumentDef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str
    templates: Templates
    parties: tuple[str, str]  # Role labels for party1 and party2, e.g. ("Provider", "Customer").
    field_keys: list[str] = Field(alias="fields")


class Registry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    partyFields: list[FieldDef]
    fields: dict[str, FieldDef]
    documents: list[DocumentDef]

    _fields_by_doc: dict[str, list[FieldDef]] = PrivateAttr(default_factory=dict)

    @model_validator(mode="after")
    def _link(self) -> "Registry":
        for key, field in self.fields.items():
            field.key = key
            if (field.type == "term") != (field.noneLabel is not None):
                raise ValueError(f"field '{key}': noneLabel is required for, and only for, term fields")
        ids = [doc.id for doc in self.documents]
        if len(set(ids)) != len(ids):
            raise ValueError("document ids must be unique")
        for doc in self.documents:
            unknown = [key for key in doc.field_keys if key not in self.fields]
            if unknown:
                raise ValueError(f"document '{doc.id}' uses undefined fields: {unknown}")
            party_fields = [
                field.model_copy(update={"key": f"{party_id}.{field.key}", "label": f"{role} {field.label}"})
                for party_id, role in zip(PARTY_IDS, doc.parties)
                for field in self.partyFields
            ]
            self._fields_by_doc[doc.id] = party_fields + [self.fields[key] for key in doc.field_keys]
        return self

    @property
    def document_ids(self) -> list[str]:
        return [doc.id for doc in self.documents]

    @property
    def all_keys(self) -> list[str]:
        """Every field key any document can have."""
        return list(dict.fromkeys(field.key for fields in self._fields_by_doc.values() for field in fields))

    def document(self, document_id: str) -> DocumentDef | None:
        return next((doc for doc in self.documents if doc.id == document_id), None)

    def fields_of(self, doc: DocumentDef) -> list[FieldDef]:
        """The document's fields in interview order: the parties, then its key terms."""
        return self._fields_by_doc[doc.id]

    def initial_values(self, doc: DocumentDef) -> Values:
        return {field.key: field.default for field in self.fields_of(doc)}

    def apply(self, doc: DocumentDef, values: Values, updates: Iterable[tuple[str, str]]) -> Values:
        """Applies (key, value) updates; keys the document doesn't have and invalid values are dropped."""
        fields = {field.key: field for field in self.fields_of(doc)}
        result = dict(values)
        for key, raw in updates:
            field = fields.get(key)
            value = coerce(field, raw) if field else None
            if value is not None:
                result[key] = value
        return result

    def clean(self, doc: DocumentDef, values: Values) -> Values:
        """Untrusted values (e.g. from the client) as a complete, valid set for the document."""
        return self.apply(doc, self.initial_values(doc), values.items())

    def switch(self, values: Values, doc: DocumentDef) -> Values:
        """Values for a newly chosen document, keeping answers whose fields it shares."""
        carried = ((key, value) for key, value in values.items() if value)
        return self.apply(doc, self.initial_values(doc), carried)


def _is_iso_date(value: str) -> bool:
    # fromisoformat alone also accepts forms like "20261008" and week dates ("2026-W41-5").
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value, re.ASCII):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def coerce(field: FieldDef, raw: str) -> str | None:
    """The value normalized for the field's type, "" to clear it, or None if it is invalid.
    Term fields can't be cleared: their cover page always shows one of the two options."""
    value = raw.strip()
    if not value:
        return None if field.type == "term" else ""
    if field.type == "date":
        return value if _is_iso_date(value) else None
    if field.type == "term":
        if value.lower() == NO_TERM:
            return NO_TERM
        # ASCII digits only: isdigit() is also true for "²", which int() rejects.
        if not re.fullmatch(r"\d+", value, re.ASCII):
            return None
        years = int(value)
        return str(years) if 1 <= years <= MAX_TERM_YEARS else None
    return value[:MAX_TEXT_LENGTH]


@lru_cache
def load_registry(path: Path) -> Registry:
    return Registry.model_validate(json.loads(path.read_text(encoding="utf-8")))
