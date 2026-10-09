# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the `templates` directory. The AI chat is used to establish what document they want and how to fill in the fields. The available documents are covered by the `catalog.json` file in the project root, included here:

@catalog.json

## Current status

Completed (merged to `main`):

- **PL-4: V1 foundation.** Docker image, FastAPI backend serving the statically exported Next.js frontend, SQLite `users` table recreated on startup, and start/stop scripts.
- **PL-5: AI chat.** `POST /api/chat` interviews the user through LiteLLM → OpenRouter with strict structured outputs and fills the document from their answers.
- **PL-6: All document types.** All 11 catalog agreements are supported; the Mutual NDA and its cover page count as one document.
  - The AI picks the document from the chat. For an unsupported request, it explains and offers the closest supported document.
  - When the user switches documents, values for fields the two documents share are kept.
  - [`documents.json`](documents.json) is the single source of truth for each document's templates, party roles and fields. Both the backend and the frontend read it.
  - The Mutual NDA fills its own cover page template. Every other document gets a generated cover page with key terms and signatures.
  - The app lives at `/create`.

Not done yet:

- Real sign-up/sign-in. Login is still a client-side stub that accepts any credentials; the `users` table exists but there are no auth endpoints.
- Saving drafts.
- Server-side PDF export. "Download PDF" uses the browser's print dialog.

Development notes:

- Docker is not installed on the main dev machine. Verify by running the backend against a fresh frontend build:

  ```bash
  cd frontend && npm run build
  cd ../backend && uv run uvicorn app.main:app --port 8000
  ```
- Backend tests: `cd backend && uv run pytest`. Set `PRELEGAL_LIVE_LLM_TESTS=1` to also run the live free-model tests.
- Frontend tests: `cd frontend && npm test`.

## Development process

When instructed to build a feature:

1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your GitHub tools

## AI design

When writing code to make calls to LLMs:

- Use LiteLLM through OpenRouter.
- Use a free model. `openai/gpt-oss-120b:free` is no longer offered for free on OpenRouter, so the default is `openrouter/nvidia/nemotron-3-super-120b-a12b:free`. It supports structured outputs and is overridable with `PRELEGAL_LLM_MODEL`; the backend refuses any model not ending in `:free`.
- Do **not** require Cerebras as the inference provider.
- Prefer free inference providers available through OpenRouter.
- Do not use paid models or paid inference providers unless explicitly instructed.
- Optimize for **zero cost**, not inference speed.
- Use Structured Outputs / JSON Schema wherever possible so that LLM responses can be reliably interpreted and used to populate fields in legal documents.
- Keep the LLM integration provider-agnostic so the model/provider can be changed through configuration rather than code changes.
- Store the OpenRouter API key in an environment variable; never hardcode API keys.

The intended architecture is:

Application → LiteLLM → OpenRouter → free model provider (currently Nemotron 3 Super 120B)

The .env file has OPEN_ROUTER_API_KEY.

### LLM cost guardrails

- LLM calls must never silently fall back to a paid model or paid provider.
- If the configured free model/provider is unavailable, fail with a clear error rather than incur a charge.
- The model name and OpenRouter configuration must be controlled through environment variables/configuration.
- Do not add automatic fallback to Claude, GPT, Gemini, Cerebras, or other paid providers.
- During development, use the free model whenever possible.

## Technical design

The entire project should be packaged into a Docker container.
The backend should be in `backend/` and be a `uv` project, using FastAPI.
The frontend should be in `frontend/`.
The database should use SQLLite and be created from scratch each time the docker contanier is brought up, 
allowing for a users table with sign up and sign in.
Consider statically building the frontend and serving it via FastAPI, if that will work.
There should be scripts in `scripts/` for:

### Mac

```text
scripts/start-mac.sh   # Start
scripts/stop-mac.sh    # Stop
```

### Linux

```text
scripts/start-linux.sh   # Start
scripts/stop-linux.sh    # Stop
```

### Windows

```text
scripts/start-windows.ps1   # Start
scripts/stop-windows.ps1   # Stop
```

Backend available at: http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad8a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`