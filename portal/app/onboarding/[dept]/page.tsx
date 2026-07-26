import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PageShell } from '@/components/page-shell';
import { Card } from '@/components/ui/card';

// Static per-dept markdown content. Phase 4 will replace with DB-backed seed content.
// Note: backticks inside template literals are escaped as \`.
const DEPT_CONTENT: Record<string, { label: string; markdown: string }> = {
  tech: {
    label: 'Engineering / Tech',
    markdown: [
      '## Welcome, Engineering team',
      '',
      'OneMCP is your central knowledge hub for runbooks, KB articles, incident guides, and on-call procedures.',
      '',
      '### Quick links',
      '',
      '- [Knowledge base articles](/artifacts?template_key=kb) — search and browse all KB articles',
      '- [Runbooks](/artifacts?template_key=runbook) — step-by-step operational runbooks',
      '- [Incident reports](/artifacts?template_key=incident) — post-mortems and incident records',
      '',
      '### Getting started',
      '',
      '1. **Browse artifacts** — go to [Artifacts](/artifacts) and filter by template or tag.',
      '2. **Search** — use [Search](/search) with **Hybrid** mode for best results across KB and runbooks.',
      '3. **Create a runbook** — click **New artifact**, pick the *Runbook* template, fill in the steps.',
      '4. **Save searches** — run a search, click **Save search** to pin it in your sidebar.',
      '',
      '### Recommended templates',
      '',
      '| Template | Use case |',
      '|---|---|',
      '| runbook | Operational step-by-step guides |',
      '| kb | Knowledge base articles, how-tos |',
      '| incident | Post-mortem and RCA documents |',
      '| adr | Architecture decision records |',
      '',
      '> **Tip:** Tag your artifacts with service names (e.g. payment-service, k8s) so teammates can filter quickly.',
    ].join('\n'),
  },

  ops: {
    label: 'Operations',
    markdown: [
      '## Welcome, Operations team',
      '',
      'OneMCP stores all your SOPs, checklists, procurement guides, and operational runbooks in one searchable place.',
      '',
      '### Quick links',
      '',
      '- [SOP templates](/artifacts?template_key=sop) — standard operating procedures',
      '- [Runbooks](/artifacts?template_key=runbook) — on-call and escalation runbooks',
      '- [All artifacts](/artifacts) — full artifact library',
      '',
      '### Getting started',
      '',
      '1. **Find a procedure** — use [Search](/search) and type a process name or keyword.',
      '2. **Create a SOP** — click **New artifact**, pick the *SOP* template, document the steps.',
      '3. **Attach files** — open any artifact and use the **Attachments** tab to upload supporting docs.',
      '4. **Review workflow** — new artifacts go to *pending* status; a reviewer must approve before *published*.',
      '',
      '### Recommended templates',
      '',
      '| Template | Use case |',
      '|---|---|',
      '| sop | Standard operating procedures |',
      '| runbook | On-call and escalation runbooks |',
      '| checklist | Pre/post-deployment checklists |',
      '| procurement | Vendor and purchase request guides |',
      '',
      '> **Tip:** Use spaces to separate ops knowledge by region or function (e.g. ops-apac, ops-infra).',
    ].join('\n'),
  },

  support: {
    label: 'Customer Support',
    markdown: [
      '## Welcome, Customer Support team',
      '',
      'OneMCP houses your FAQ playbooks, ticket response templates, and escalation paths.',
      '',
      '### Quick links',
      '',
      '- [FAQ playbooks](/artifacts?template_key=faq) — common questions and answers',
      '- [Ticket templates](/artifacts?template_key=ticket-playbook) — response scripts by issue type',
      '- [All artifacts](/artifacts) — full artifact library',
      '',
      '### Getting started',
      '',
      '1. **Search for an answer** — use [Search](/search) with the customer\'s keywords.',
      '2. **Use a response template** — open a ticket-playbook artifact and copy the response.',
      '3. **Create new playbook** — click **New artifact**, pick *Ticket playbook*, document the resolution flow.',
      '4. **Escalation path** — if no playbook exists, check the *Escalation* tag or create an incident record.',
      '',
      '### Recommended templates',
      '',
      '| Template | Use case |',
      '|---|---|',
      '| faq | Frequently asked questions |',
      '| ticket-playbook | Step-by-step ticket resolution guides |',
      '| escalation | Escalation decision trees |',
      '| release-note | Customer-facing release notes |',
      '',
      '> **Tip:** Tag playbooks with product area (e.g. billing, login, api) for fast filtering.',
    ].join('\n'),
  },
};

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
          text-sm leading-relaxed text-secondary-800 dark:text-secondary-200
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-secondary-900 [&_h2]:dark:text-secondary-50 [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:first:mt-0
          [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-secondary-800 [&_h3]:dark:text-secondary-100 [&_h3]:mb-2 [&_h3]:mt-4
          [&_p]:mb-3
          [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
          [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
          [&_a]:text-primary-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-primary-800
          [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_blockquote]:italic [&_blockquote]:mb-3
          [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs
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
