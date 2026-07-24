'use client';

import { Suspense } from 'react';
import { PageShell } from '../components/page-shell';
import { WidgetSkeleton, RecentActivityWidget, MyDraftsWidget, PendingReviewWidget } from '../components/dashboard-widgets';
import { TopViewedWidget, TopTagsWidget } from '../components/dashboard-widgets-extra';

// CTA row — primary actions at top of dashboard
function CtaRow() {
  return (
    <div className="mb-6 flex flex-wrap gap-3">
      <a
        href="/artifacts/new"
        className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600"
      >
        New artifact
      </a>
      <a
        href="/search"
        className="rounded-md border border-secondary-300 bg-white px-4 py-2 text-sm font-medium text-secondary-700 hover:bg-secondary-50 dark:border-secondary-700 dark:bg-secondary-900 dark:text-secondary-300 dark:hover:bg-secondary-800"
      >
        Search
      </a>
    </div>
  );
}

// Dashboard home — 5 widgets in a responsive grid.
// Icons used: Clock (widget 1 header) = 1 total. CTA uses text-only.
// Icon budget: 1 / 8 max — well within guardrail.
export default function DashboardPage() {
  return (
    // Suspense boundary required because child widgets use useSearchParams indirectly
    // via useCurrentSpace → SpaceProvider which reads searchParams.
    <Suspense>
      <PageShell title="Dashboard">
        <CtaRow />

        {/* Widget grid: 1 col mobile → 2 col md → 3 col lg */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Widget 1: Recent activity — spans full width on lg to anchor the grid */}
          <div className="lg:col-span-2">
            <Suspense fallback={<WidgetSkeleton />}>
              <RecentActivityWidget />
            </Suspense>
          </div>

          {/* Widget 3: Pending review — summary count, smaller footprint */}
          <div>
            <Suspense fallback={<WidgetSkeleton />}>
              <PendingReviewWidget />
            </Suspense>
          </div>

          {/* Widget 2: My drafts */}
          <div>
            <Suspense fallback={<WidgetSkeleton />}>
              <MyDraftsWidget />
            </Suspense>
          </div>

          {/* Widget 4: Top viewed */}
          <div>
            <Suspense fallback={<WidgetSkeleton />}>
              <TopViewedWidget />
            </Suspense>
          </div>

          {/* Widget 5: Top tags */}
          <div>
            <Suspense fallback={<WidgetSkeleton />}>
              <TopTagsWidget />
            </Suspense>
          </div>
        </div>
      </PageShell>
    </Suspense>
  );
}
