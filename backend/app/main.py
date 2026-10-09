"""FastAPI entry point: serves the JSON API under /api and the statically exported frontend at /."""

from contextlib import asynccontextmanager, closing
from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints

from app.auth import (
    SESSION_COOKIE,
    SESSION_DAYS,
    EmailTakenError,
    User,
    authenticate,
    create_session,
    create_user,
    delete_session,
    user_for_session,
)
from app.chat import (
    ChatMessage,
    ChatRequest,
    ChatResponse,
    LlmResponseError,
    LlmUnavailableError,
    UnknownDocumentError,
    chat_turn,
)
from app.config import Settings
from app.db import connect, init_db
from app.documents import load_registry
from app.drafts import Draft, DraftNotFoundError, DraftSummary, ensure_owned, get_draft, list_drafts, save_draft

# A loose shape check; the real proof of an address would be a verification email.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class SignUpRequest(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=254, pattern=EMAIL_PATTERN)]
    # Capped so a huge password can't make scrypt hashing expensive.
    password: str = Field(min_length=8, max_length=128)


class SignInRequest(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=254)]
    password: str = Field(min_length=1, max_length=128)


class Account(BaseModel):
    email: str


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    # Loaded up front so a missing or invalid documents.json fails at startup, not mid-chat.
    registry = load_registry(settings.documents_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        init_db(settings.database_path)
        yield

    app = FastAPI(title="PreLegal", lifespan=lifespan)

    def db():
        return closing(connect(settings.database_path))

    # Scripts can't read the cookie, and other sites' forms and fetches don't send it.
    cookie_flags = {"httponly": True, "samesite": "lax", "secure": settings.cookie_secure}

    def start_session(response: Response, user: User) -> Account:
        with db() as conn:
            token = create_session(conn, user)
        response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_DAYS * 24 * 60 * 60, **cookie_flags)
        return Account(email=user.email)

    def current_user(session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None) -> User:
        user = None
        if session:
            with db() as conn:
                user = user_for_session(conn, session)
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue.")
        return user

    CurrentUser = Annotated[User, Depends(current_user)]

    @app.get("/api/health")
    def health() -> dict[str, str]:
        with db() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok"}

    # ---------- Accounts ----------

    @app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
    def sign_up(body: SignUpRequest, response: Response) -> Account:
        try:
            with db() as conn:
                user = create_user(conn, body.email, body.password)
        except EmailTakenError as exc:
            raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
        return start_session(response, user)

    @app.post("/api/auth/signin")
    def sign_in(body: SignInRequest, response: Response) -> Account:
        with db() as conn:
            user = authenticate(conn, body.email, body.password)
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
        return start_session(response, user)

    @app.post("/api/auth/signout", status_code=status.HTTP_204_NO_CONTENT)
    def sign_out(response: Response, session: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None) -> None:
        if session:
            with db() as conn:
                delete_session(conn, session)
        response.delete_cookie(SESSION_COOKIE, **cookie_flags)

    @app.get("/api/auth/me")
    def me(user: CurrentUser) -> Account:
        return Account(email=user.email)

    # ---------- Drafts ----------

    @app.get("/api/drafts")
    def drafts(user: CurrentUser) -> list[DraftSummary]:
        with db() as conn:
            return list_drafts(conn, registry, user.id)

    @app.get("/api/drafts/{draft_id}")
    def draft(draft_id: int, user: CurrentUser) -> Draft:
        try:
            with db() as conn:
                return get_draft(conn, registry, user.id, draft_id)
        except DraftNotFoundError as exc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That document could not be found.") from exc

    # ---------- Chat ----------

    @app.post("/api/chat")
    def chat(request: ChatRequest, user: CurrentUser) -> ChatResponse:
        try:
            # Checked before the LLM call, so a bad draft id costs no request.
            if request.draftId is not None:
                with db() as conn:
                    ensure_owned(conn, user.id, request.draftId)
            response = chat_turn(request, settings, registry)
        except DraftNotFoundError as exc:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "That document could not be found.") from exc
        except UnknownDocumentError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
        except LlmUnavailableError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
        except LlmResponseError as exc:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc

        # Autosave: once a document is selected, every turn updates the user's draft of it.
        if response.documentId is None:
            return response.model_copy(update={"draftId": request.draftId})
        messages = [*request.messages, ChatMessage(role="assistant", content=response.reply)]
        with db() as conn:
            draft_id = save_draft(conn, user.id, request.draftId, response.documentId, response.values, messages)
        return response.model_copy(update={"draftId": draft_id})

    # Mounted last so it never shadows /api routes. Skipped when the frontend
    # hasn't been built (e.g. running the API alone during development).
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")

    return app


app = create_app()
