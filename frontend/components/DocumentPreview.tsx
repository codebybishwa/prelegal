import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { DRAFT_DISCLAIMER } from "@/lib/disclaimer";

type Props = {
  coverPage: string;
  standardTerms: string;
};

// The templates contain trusted inline HTML (<label>, <span class="keyterms_link">);
// user input is escaped when the cover page is built, before it reaches the markdown.
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];

export default function DocumentPreview({ coverPage, standardTerms }: Props) {
  return (
    <article className="legal-document mx-auto max-w-[8.5in] bg-white px-8 py-10 shadow-sm sm:px-16 sm:py-14 print:max-w-none print:p-0 print:shadow-none">
      {/* Part of the document, so the downloaded PDF carries it too. */}
      <p className="draft-notice" role="note">
        <strong>Draft: subject to legal review.</strong> {DRAFT_DISCLAIMER}
      </p>
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {coverPage}
      </Markdown>
      <div className="page-break" />
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {standardTerms}
      </Markdown>
    </article>
  );
}
