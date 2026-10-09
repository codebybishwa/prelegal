import json
import sqlite3
from contextlib import closing
from typing import Any

from fastapi.testclient import TestClient

from app.config import Settings
from tests.test_chat import REGISTRY, chat_body, client, fake_llm, nda_values, settings, sign_up, turn  # noqa: F401


def history(body: dict[str, Any], reply: str) -> list[dict[str, str]]:
    return [*body["messages"], {"role": "assistant", "content": reply}]


def test_first_turn_with_a_document_creates_a_draft(client: TestClient, fake_llm):
    fake_llm(turn("An NDA. Who is the other party?", "mutual-nda", **{"party1.company": "Acme Inc"}))
    body = chat_body("An NDA for Acme please", None)

    response = client.post("/api/chat", json=body)

    assert response.json()["draftId"] == 1
    [summary] = client.get("/api/drafts").json()
    assert summary["id"] == 1
    assert summary["documentId"] == "mutual-nda"
    assert summary["parties"] == ["Acme Inc"]
    assert summary["updatedAt"].endswith("Z")

    draft = client.get("/api/drafts/1").json()
    assert draft["documentId"] == "mutual-nda"
    assert draft["values"] == nda_values(**{"party1.company": "Acme Inc"})
    assert draft["messages"] == history(body, "An NDA. Who is the other party?")


def test_no_draft_until_a_document_is_selected(client: TestClient, fake_llm):
    fake_llm(turn("What would you like to draft?"))

    response = client.post("/api/chat", json=chat_body("Hi", None))

    assert response.json()["draftId"] is None
    assert client.get("/api/drafts").json() == []


def test_later_turns_update_the_same_draft(client: TestClient, fake_llm):
    fake_llm(turn("Which law?", "mutual-nda"))
    first = client.post("/api/chat", json=chat_body("An NDA", None)).json()

    fake_llm(turn("Switched to a pilot.", "pilot-agreement", **{"party2.company": "Globex"}))
    body = chat_body("Make it a pilot with Globex", "mutual-nda")
    body["draftId"] = first["draftId"]
    second = client.post("/api/chat", json=body).json()

    assert second["draftId"] == first["draftId"]
    [summary] = client.get("/api/drafts").json()
    assert summary["documentId"] == "pilot-agreement"
    assert summary["parties"] == ["Globex"]
    assert client.get(f"/api/drafts/{first['draftId']}").json()["messages"] == history(body, "Switched to a pilot.")


def test_separate_conversations_make_separate_drafts_newest_first(client: TestClient, fake_llm):
    fake_llm(turn("Ok", "mutual-nda"))
    client.post("/api/chat", json=chat_body("An NDA", None))
    fake_llm(turn("Ok", "pilot-agreement"))
    client.post("/api/chat", json=chat_body("A pilot", None))

    drafts = client.get("/api/drafts").json()

    assert [d["documentId"] for d in drafts] == ["pilot-agreement", "mutual-nda"]


def test_failed_turn_saves_nothing(client: TestClient, fake_llm):
    fake_llm("not json")

    assert client.post("/api/chat", json=chat_body()).status_code == 502
    assert client.get("/api/drafts").json() == []


def test_users_only_see_their_own_drafts(client: TestClient, fake_llm):
    fake = fake_llm(turn("Ok", "mutual-nda"))
    client.post("/api/chat", json=chat_body("An NDA", None))
    client.post("/api/auth/signout")
    sign_up(client, "bob@globex.com")

    assert client.get("/api/drafts").json() == []
    assert client.get("/api/drafts/1").status_code == 404

    body = chat_body("Let me edit Ada's NDA")
    body["draftId"] = 1
    response = client.post("/api/chat", json=body)
    assert response.status_code == 404
    assert len(fake.calls) == 1  # Bob's attempt never reached the LLM.


def test_unknown_draft_is_404(client: TestClient):
    response = client.get("/api/drafts/99")

    assert response.status_code == 404
    assert response.json() == {"detail": "That document could not be found."}


def test_stored_values_are_cleaned_on_read(client: TestClient, fake_llm, settings: Settings):
    fake_llm(turn("Ok", "mutual-nda"))
    client.post("/api/chat", json=chat_body("An NDA", None))
    tampered = {**nda_values(governingLaw="Delaware"), "effectiveDate": "not a date", "bogus": "x"}
    with closing(sqlite3.connect(settings.database_path)) as conn:
        conn.execute("UPDATE drafts SET values_json = ?", (json.dumps(tampered),))
        conn.commit()

    assert client.get("/api/drafts/1").json()["values"] == nda_values(governingLaw="Delaware")


def test_drafts_of_documents_no_longer_offered_are_hidden(client: TestClient, fake_llm, settings: Settings):
    fake_llm(turn("Ok", "mutual-nda"))
    client.post("/api/chat", json=chat_body("An NDA", None))
    with closing(sqlite3.connect(settings.database_path)) as conn:
        conn.execute("UPDATE drafts SET document_id = 'retired-document'")
        conn.commit()

    assert client.get("/api/drafts").json() == []
    assert client.get("/api/drafts/1").status_code == 404


def test_draft_values_cover_every_field_of_the_document(client: TestClient, fake_llm):
    fake_llm(turn("Ok", "cloud-service-agreement"))
    client.post("/api/chat", json=chat_body("A CSA", None))

    values = client.get("/api/drafts/1").json()["values"]

    assert values == REGISTRY.initial_values(REGISTRY.document("cloud-service-agreement"))
