'use client';

import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface Props {
  source: string;
}

// Safe markdown render — rehype-sanitize strip nguy hiểm tags/attrs (XSS mitigation).
// remark-gfm cho tables, task lists, autolinks.
// Style qua Tailwind + prose (không dùng @tailwindcss/typography, tự chỉnh minimal).
export function MarkdownView({ source }: Props) {
  return (
    <div className="markdown-body space-y-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200
                    [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold
                    [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 dark:[&_h2]:text-slate-100
                    [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold
                    [&_p]:my-2
                    [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6
                    [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6
                    [&_li]:my-1
                    [&_a]:text-blue-600 [&_a]:underline
                    [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs
                    dark:[&_code]:bg-slate-800
                    [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:text-xs
                    dark:[&_pre]:bg-slate-800
                    [&_pre_code]:bg-transparent [&_pre_code]:p-0
                    [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600
                    dark:[&_blockquote]:border-slate-600 dark:[&_blockquote]:text-slate-400
                    [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                    [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left
                    [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1
                    dark:[&_th]:border-slate-700 dark:[&_th]:bg-slate-800
                    dark:[&_td]:border-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
