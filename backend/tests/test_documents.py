import json
import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.config import DEFAULT_DOCUMENTS_PATH
from app.documents import FieldDef, Registry, coerce, load_registry

REPO_DIR = DEFAULT_DOCUMENTS_PATH.parent
REGISTRY = load_registry(DEFAULT_DOCUMENTS_PATH)
DOCS = {doc.id: doc for doc in REGISTRY.documents}

# A defined term in a template that the cover page supplies, e.g. <span class="keyterms_link">Fees</span>.
TERM_SPAN = re.compile(r'<span class="\w+_link"[^>]*>([^<]+)</span>')


def normalize(term: str) -> str:
    """Treat "Provider's", "Subscription Periods" and "Subscription Period" as the same term."""
    term = re.sub(r"['’]s$", "", term.strip().lower())
    return term.removesuffix("s")


# ---------- documents.json matches the templates and catalog ----------


def test_every_catalog_template_belongs_to_exactly_one_document():
    catalog = json.loads((REPO_DIR / "catalog.json").read_text(encoding="utf-8"))
    used = [name for doc in REGISTRY.documents for name in (doc.templates.terms, doc.templates.coverPage) if name]

    assert sorted(used) == sorted(Path(entry["filename"]).name for entry in catalog)


@pytest.mark.parametrize("doc_id", DOCS)
def test_template_files_exist(doc_id: str):
    templates = DOCS[doc_id].templates
    for name in (templates.terms, templates.coverPage):
        if name:
            assert (REPO_DIR / "templates" / name).is_file()


@pytest.mark.parametrize("doc_id", DOCS)
def test_fields_cover_every_term_the_template_references(doc_id: str):
    doc = DOCS[doc_id]
    text = (REPO_DIR / "templates" / doc.templates.terms).read_text(encoding="utf-8")
    terms = {normalize(term) for term in TERM_SPAN.findall(text)}

    covered = {normalize(role) for role in doc.parties} | {normalize(f.label) for f in REGISTRY.partyFields}
    for key in doc.field_keys:
        field = REGISTRY.fields[key]
        covered |= {normalize(term) for term in [field.label, *field.covers]}

    assert terms - covered == set()


def test_shared_definitions_are_consistent():
    assert len(DOCS) == 11
    for doc in REGISTRY.documents:
        keys = [field.key for field in REGISTRY.fields_of(doc)]
        assert len(keys) == len(set(keys)), doc.id
    # Every defined field is used by some document.
    used = {key for doc in REGISTRY.documents for key in doc.field_keys}
    assert used == set(REGISTRY.fields)


# ---------- Registry ----------


def test_party_fields_are_expanded_first_with_role_labels():
    fields = REGISTRY.fields_of(DOCS["pilot-agreement"])

    assert [f.key for f in fields[:5]] == [
        "party1.name",
        "party1.title",
        "party1.company",
        "party1.noticeAddress",
        "party2.name",
    ]
    assert fields[0].label == "Provider Print Name"
    assert fields[4].label == "Customer Print Name"
    assert fields[8].key == "effectiveDate"


def test_initial_values_use_defaults():
    values = REGISTRY.initial_values(DOCS["mutual-nda"])

    assert values["mndaTerm"] == "1"
    assert values["purpose"].startswith("Evaluating")
    assert values["governingLaw"] == ""
    assert values["party1.name"] == ""


def test_apply_drops_unknown_keys_and_invalid_values():
    doc = DOCS["mutual-nda"]
    values = REGISTRY.initial_values(doc)

    result = REGISTRY.apply(
        doc,
        values,
        [
            ("governingLaw", " Delaware "),
            ("party2.company", "Globex"),
            ("pilotPeriod", "60 days"),  # Another document's field.
            ("nonsense", "x"),
            ("effectiveDate", "next Tuesday"),
            ("mndaTerm", "none"),
        ],
    )

    assert result["governingLaw"] == "Delaware"
    assert result["party2.company"] == "Globex"
    assert result["mndaTerm"] == "none"
    assert result["effectiveDate"] == ""
    assert set(result) == set(values)
    assert values["governingLaw"] == ""  # Not mutated.


def test_clean_completes_and_validates_client_values():
    doc = DOCS["pilot-agreement"]

    result = REGISTRY.clean(doc, {"pilotPeriod": "60 days", "effectiveDate": "bad", "extra": "x"})

    assert result == {**REGISTRY.initial_values(doc), "pilotPeriod": "60 days"}


def test_switch_keeps_shared_answers_and_drops_the_rest():
    nda = DOCS["mutual-nda"]
    values = REGISTRY.apply(
        nda,
        REGISTRY.initial_values(nda),
        [("party1.company", "Acme"), ("governingLaw", "Delaware"), ("mndaTerm", "3"), ("chosenCourts", "")],
    )

    result = REGISTRY.switch(values, DOCS["cloud-service-agreement"])

    assert result["party1.company"] == "Acme"
    assert result["governingLaw"] == "Delaware"
    assert "mndaTerm" not in result
    assert "purpose" not in result
    assert result["subscriptionPeriod"] == ""


def test_switch_keeps_new_defaults_for_blank_answers():
    csa = DOCS["cloud-service-agreement"]
    values = REGISTRY.initial_values(csa)

    result = REGISTRY.switch(values, DOCS["mutual-nda"])

    assert result["mndaTerm"] == "1"
    assert result["purpose"].startswith("Evaluating")


@pytest.mark.parametrize(
    ("field_type", "raw", "expected"),
    [
        ("text", "  hello  ", "hello"),
        ("text", "", ""),
        ("text", "x" * 3000, "x" * 2000),
        ("date", "2026-10-08", "2026-10-08"),
        ("date", "October 8, 2026", None),
        ("date", "2026-13-01", None),
        ("date", "20261008", None),
        ("date", "2026-W41-5", None),
        ("date", "２０２６-10-08", None),
        ("date", " ", ""),
        ("term", "3", "3"),
        ("term", "03", "3"),
        ("term", "NONE", "none"),
        ("term", "0", None),
        ("term", "11", None),
        ("term", "two", None),
        ("term", "", None),
        ("term", "²", None),
        ("term", "١", None),
    ],
)
def test_coerce(field_type: str, raw: str, expected: str | None):
    field = FieldDef(label="X", type=field_type, description="x", noneLabel="Never" if field_type == "term" else None)
    assert coerce(field, raw) == expected


def registry_json(**overrides) -> dict:
    data = {
        "partyFields": [{"key": "name", "label": "Name", "type": "text", "description": "d"}],
        "fields": {"a": {"label": "A", "type": "text", "description": "d"}},
        "documents": [
            {"id": "x", "name": "X", "description": "d", "templates": {"terms": "x.md"}, "parties": ["P", "Q"], "fields": ["a"]}
        ],
    }
    data.update(overrides)
    return data


@pytest.mark.parametrize(
    "overrides",
    [
        {"fields": {}},  # Document uses an undefined field.
        {"fields": {"a": {"label": "A", "type": "term", "description": "d"}}},  # Term without noneLabel.
        {"fields": {"a": {"label": "A", "type": "text", "description": "d", "typo": 1}}},
        {
            "documents": [
                {"id": "x", "name": "X", "description": "d", "templates": {"terms": "x.md"}, "parties": ["P", "Q"], "fields": []}
            ]
            * 2
        },
    ],
)
def test_invalid_registry_is_rejected(overrides: dict):
    with pytest.raises(ValidationError):
        Registry.model_validate(registry_json(**overrides))
