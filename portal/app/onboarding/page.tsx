import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { Card } from '@/components/ui/card';

// Dept picker — static list. Phase 4 will replace with DB-backed fetch.
const DEPTS = [
  {
    key: 'tech',
    label: 'Engineering / Tech',
    description: 'Runbooks, KB articles, incident templates, and on-call guides for the tech team.',
  },
  {
    key: 'ops',
    label: 'Operations',
    description: 'SOPs, process checklists, procurement guides, and operational runbooks.',
  },
  {
    key: 'support',
    label: 'Customer Support',
    description: 'FAQ playbooks, ticket templates, escalation paths, and response scripts.',
  },
] as const;

export default function OnboardingPage() {
  return (
    <PageShell
      title="Onboarding"
      breadcrumb={[{ label: 'Onboarding' }]}
    >
      <p className="mb-8 text-sm text-muted-foreground max-w-prose">
        Welcome to OneMCP. Select your department to see a tailored getting-started guide with
        relevant templates and artifact collections.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEPTS.map((dept) => (
          <Link key={dept.key} href={`/onboarding/${dept.key}`} className="group block">
            {/* Option A card: border hover, no shadow */}
            <Card className="h-full p-6 transition-colors group-hover:bg-muted/50">
              <h2 className="text-sm font-semibold text-foreground">
                {dept.label}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">{dept.description}</p>
              <span className="mt-4 inline-block text-xs font-medium text-foreground group-hover:underline">
                View guide →
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
