'use client';

import { Suspense } from 'react';
import { DashboardGreeting } from '../components/dashboard-greeting';
import { DashboardStatCards } from '../components/dashboard-stat-cards';
import { WidgetSkeleton, RecentActivityWidget } from '../components/dashboard-widgets';
import { TopViewedWidget, TopTagsWidget } from '../components/dashboard-widgets-extra';

// Dashboard home — greeting + stat cards + 2-column widget layout.
// AppShell provides sidebar; this page owns main content area only.
export default function DashboardPage() {
  return (
    // Suspense required: child widgets + stat cards use useCurrentSpace (searchParams)
    <Suspense>
      <div className="px-6 py-6 space-y-4">
        {/* Greeting header + CTAs */}
        <DashboardGreeting />

        {/* 3 stat cards (SEARCH HIT RATE hidden — no backend metric) */}
        <DashboardStatCards />

        {/* 2-column widget layout: recent activity wide + top viewed/tags stacked */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<WidgetSkeleton />}>
              <RecentActivityWidget />
            </Suspense>
          </div>
          <div className="space-y-4">
            <Suspense fallback={<WidgetSkeleton />}>
              <TopViewedWidget />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton />}>
              <TopTagsWidget />
            </Suspense>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
