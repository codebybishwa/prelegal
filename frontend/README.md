# PreLegal frontend

Next.js app for drafting legal agreements. It currently ships the **Mutual NDA Creator**:
chat with the AI (PL-5), which asks about the agreement and fills in the key terms, review the
completed Common Paper Mutual NDA in the live preview, and click **Download PDF** to save it via
the browser's print dialog ("Save as PDF").

Agreement text is read at build time from the repo-level [`templates/`](../templates) directory,
which remains the single source of truth.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests (Vitest)
npm run lint
npm run build
```

The chat calls the backend at the same origin (`/api/chat`), so `npm run dev` alone shows the UI
but cannot chat. To try the chat, run `npm run build` and serve `out/` through the backend
(see [`backend/README.md`](../backend/README.md)) at http://localhost:8000.

## Structure

- `app/page.tsx`: server component that loads the NDA templates and renders the creator
- `components/NdaCreator.tsx`: NDA state, layout and PDF download
- `components/NdaChat.tsx`: AI chat that fills in the cover page terms and party details
- `lib/chat.ts`: `/api/chat` client and `applyUpdates`, which merges the AI's field changes
- `components/NdaPreview.tsx`: renders the filled cover page and standard terms from markdown
- `lib/nda.ts`: NDA data model and `fillCoverPage`, which fills the cover page template
- `lib/templates.ts`: reads templates from `../templates`
