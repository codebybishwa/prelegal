"""Each user's drafted documents: the document, its values and the chat that produced them.

Drafts are saved after every chat turn that has a document selected. Stored values are
cleaned against documents.json again when read, like any other untrusted input.
"""

import json
import sqlite3

from pydantic import BaseModel

from app.chat import ChatMessage
from app.documents import Registry, Values

# Stored timestamps are UTC; the API returns them as ISO 8601 so browsers parse them as such.
_ISO_UPDATED_AT = "strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)"


class DraftNotFoundError(Exception):
    """The draft doesn't exist or belongs to another user."""


class DraftSummary(BaseModel):
    id: int
    documentId: str
    # The parties' company names that are filled in, for telling drafts apart.
    parties: list[str]
    updatedAt: str


class Draft(BaseModel):
    id: int
    documentId: str
    values: Values
    messages: list[ChatMessage]
    updatedAt: str


def save_draft(
    conn: sqlite3.Connection,
    user_id: int,
    draft_id: int | None,
    document_id: str,
    values: Values,
    messages: list[ChatMessage],
) -> int:
    """Creates a draft, or updates the user's draft `draft_id`. Returns the draft's id."""
    values_json = json.dumps(values)
    messages_json = json.dumps([m.model_dump() for m in messages])
    with conn:
        if draft_id is None:
            cursor = conn.execute(
                "INSERT INTO drafts (user_id, document_id, values_json, messages_json) VALUES (?, ?, ?, ?)",
                (user_id, document_id, values_json, messages_json),
            )
            return cursor.lastrowid
        cursor = conn.execute(
            "UPDATE drafts SET document_id = ?, values_json = ?, messages_json = ?, updated_at = CURRENT_TIMESTAMP "
            "WHERE id = ? AND user_id = ?",
            (document_id, values_json, messages_json, draft_id, user_id),
        )
    if cursor.rowcount == 0:
        raise DraftNotFoundError(f"Draft {draft_id} not found.")
    return draft_id


def ensure_owned(conn: sqlite3.Connection, user_id: int, draft_id: int) -> None:
    row = conn.execute("SELECT 1 FROM drafts WHERE id = ? AND user_id = ?", (draft_id, user_id)).fetchone()
    if row is None:
        raise DraftNotFoundError(f"Draft {draft_id} not found.")


def list_drafts(conn: sqlite3.Connection, registry: Registry, user_id: int) -> list[DraftSummary]:
    """The user's drafts, most recently updated first. Drafts of documents no longer offered are left out."""
    rows = conn.execute(
        f"SELECT id, document_id, values_json, {_ISO_UPDATED_AT} FROM drafts "
        "WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
        (user_id,),
    ).fetchall()
    summaries = []
    for draft_id, document_id, values_json, updated_at in rows:
        if registry.document(document_id) is None:
            continue
        values = json.loads(values_json)
        parties = [values[key].strip() for key in ("party1.company", "party2.company") if values.get(key, "").strip()]
        summaries.append(DraftSummary(id=draft_id, documentId=document_id, parties=parties, updatedAt=updated_at))
    return summaries


def get_draft(conn: sqlite3.Connection, registry: Registry, user_id: int, draft_id: int) -> Draft:
    row = conn.execute(
        f"SELECT document_id, values_json, messages_json, {_ISO_UPDATED_AT} FROM drafts WHERE id = ? AND user_id = ?",
        (draft_id, user_id),
    ).fetchone()
    doc = registry.document(row[0]) if row else None
    if doc is None:
        raise DraftNotFoundError(f"Draft {draft_id} not found.")
    return Draft(
        id=draft_id,
        documentId=doc.id,
        values=registry.clean(doc, json.loads(row[1])),
        messages=json.loads(row[2]),
        updatedAt=row[3],
    )
