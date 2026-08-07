import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PageShell } from '@/components/page-shell';
import { Card } from '@/components/ui/card';
import { DEPT_CONTENT } from './dept-content';

interface Props {
  params: Promise<{ dept: string }>;
}

export default async function OnboardingDeptPage({ params }: Props) {
  const { dept } = await params;
  const content = DEPT_CONTENT[dept];

  if (!content) notFound();

  return (
    <PageShell
      title={`Onboarding — ${content.label}`}
      breadcrumb={[
        { label: 'Onboarding', href: '/onboarding' },
        { label: content.label },
      ]}
    >
      <Card className="max-w-3xl p-8">
        {/* Scoped markdown styles — no @tailwindcss/typography dependency */}
        <div className="
          text-sm leading-relaxed text-foreground
          [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:first:mt-0
          [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mb-2 [&_h3]:mt-4
          [&_h4]:text-sm [&_h4]:font-medium [&_h4]:text-muted-foreground [&_h4]:mb-1 [&_h4]:mt-3
          [&_p]:mb-3
          [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
          [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
          [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_blockquote]:mb-3
          [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs
          [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:mb-3
          [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:mb-3
          [&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium
          [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.markdown}
          </ReactMarkdown>
        </div>
      </Card>
    </PageShell>
  );
}

// Pre-render known dept routes at build time.
export function generateStaticParams() {
  return Object.keys(DEPT_CONTENT).map((dept) => ({ dept }));
}
