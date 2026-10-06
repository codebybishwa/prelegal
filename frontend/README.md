# PreLegal frontend

Next.js app for drafting legal agreements. It currently ships the **Mutual NDA Creator** (PL-3):
fill in the key terms in the form, review the completed Common Paper Mutual NDA in the live
preview, and click **Download PDF** to save it via the browser's print dialog ("Save as PDF").

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

## Structure

- `app/page.tsx`: server component that loads the NDA templates and renders the creator
- `components/NdaCreator.tsx`: form state, layout and PDF download
- `components/NdaForm.tsx`: cover page terms and party details
- `components/NdaPreview.tsx`: renders the filled cover page and standard terms from markdown
- `lib/nda.ts`: NDA data model and `fillCoverPage`, which fills the cover page template
- `lib/templates.ts`: reads templates from `../templates`
