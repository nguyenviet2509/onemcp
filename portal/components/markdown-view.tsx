'use client';

import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface Props {
  source: string;
}

// Extract raw text from ReactMarkdown pre children — used for clipboard copy.
function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return '';
}

// Custom <pre> block with copy-to-clipboard button.
function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(extractText(children));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked — ignore silently
    }
  }
  return (
    <div className="group relative my-3">
      <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{children}</pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={copied ? 'Copied' : 'Copy code'}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

// Safe markdown render — rehype-sanitize strip nguy hiểm tags/attrs (XSS mitigation).
// Custom pre block adds copy-clipboard button (visible on hover).
export function MarkdownView({ source }: Props) {
  return (
    <div className="markdown-body space-y-4 text-sm leading-relaxed text-foreground
                    [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold
                    [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground
                    [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold
                    [&_p]:my-2
                    [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6
                    [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6
                    [&_li]:my-1
                    [&_a]:text-primary [&_a]:underline
                    [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs
                    [&_pre_code]:bg-transparent [&_pre_code]:p-0
                    [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground
                    [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                    [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left
                    [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{ pre: CodeBlock }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
