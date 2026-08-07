import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageShell } from '@/components/page-shell';
import { Card } from '@/components/ui/card';

// Dept picker — static keys; labels + descriptions come from the i18n catalog
// so both VI and EN copy can be maintained centrally.
const DEPT_KEYS = ['tech', 'ops', 'support'] as const;

export default async function OnboardingPage() {
  const t = await getTranslations('pages.onboarding');
  const tNav = await getTranslations('nav');
  return (
    <PageShell
      title={t('title')}
      breadcrumb={[{ label: tNav('onboarding') }]}
    >
      <p className="mb-8 text-sm text-muted-foreground max-w-prose">
        {t('welcome')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEPT_KEYS.map((key) => (
          <Link key={key} href={`/onboarding/${key}`} className="group block">
            {/* Option A card: border hover, no shadow */}
            <Card className="h-full p-6 transition-colors group-hover:bg-muted/50">
              <h2 className="text-sm font-semibold text-foreground">
                {t(`depts.${key}.label`)}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(`depts.${key}.description`)}
              </p>
              <span className="mt-4 inline-block text-xs font-medium text-foreground group-hover:underline">
                {t('viewGuide')}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
