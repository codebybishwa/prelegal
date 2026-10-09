# PreLegal frontend

Next.js app for drafting legal agreements. The **Document Creator** (`/create`) supports every
Common Paper agreement in [`documents.json`](../documents.json): tell the AI what you need, and
it picks the agreement (or suggests the closest one it can draft), asks about the key terms and
fills them in. Review the completed agreement in the live preview, and click **Download PDF** to
save it via the browser's print dialog ("Save as PDF").

The document definitions and agreement text are read at build time from the repo-level
`documents.json` and [`templates/`](../templates), which remain the single source of truth. The
Mutual NDA fills its own cover page template; the other agreements get a generated cover page
with a key terms table and signature block.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests (Vitest)
npm run lint
npm run build
```

The chat calls `/api/chat` on the same origin. In production that's FastAPI serving `out/`. Under
`npm run dev`, Next proxies `/api/*` to the backend, so run it too (see
[`backend/README.md`](../backend/README.md)). It defaults to http://localhost:8000; override it with
`PRELEGAL_API_URL`.

## Structure

- `app/create/page.tsx`: server component that loads the document definitions and templates
- `components/DocumentCreator.tsx`: selected document state, layout and PDF download
- `components/DocumentChat.tsx`: AI chat that picks the document and fills in its fields
- `components/DocumentPreview.tsx`: renders the cover page and standard terms from markdown
- `lib/chat.ts`: `/api/chat` client; the backend returns the document and its values each turn
- `lib/documents.ts`: document definition types and value formatting
- `lib/coverPage.ts`: renders a document's cover page (filled template or generated)
- `lib/nda.ts`: Mutual NDA cover page filling (`fillCoverPage`, `toNdaData`)
- `lib/markdown.ts`: escaping and formatting helpers for user input in markdown
- `lib/templates.ts`: reads `../documents.json` and `../templates` at build time
