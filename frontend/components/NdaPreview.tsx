import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

type Props = {
  coverPage: string;
  standardTerms: string;
};

// The templates contain trusted inline HTML (<label>, <span class="coverpage_link">);
// user input is escaped in fillCoverPage before it reaches the markdown.
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeRaw];

export default function NdaPreview({ coverPage, standardTerms }: Props) {
  return (
    <article className="nda-document mx-auto max-w-[8.5in] bg-white px-8 py-10 shadow-sm sm:px-16 sm:py-14 print:max-w-none print:p-0 print:shadow-none">
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {coverPage}
      </Markdown>
      <div className="nda-page-break" />
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {standardTerms}
      </Markdown>
    </article>
  );
}
