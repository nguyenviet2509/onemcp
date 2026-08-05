'use client';

import { Suspense } from 'react';
import { DashboardGreeting } from '@/components/dashboard-greeting';
import { DashboardStatCards } from '@/components/dashboard-stat-cards';
import { WidgetSkeleton, RecentActivityWidget } from '@/components/dashboard-widgets';
import { TopViewedWidget, TopTagsWidget } from '@/components/dashboard-widgets-extra';

// Dashboard home — Option A: px-8 py-6, space-y-6 between sections.
export default function DashboardPage() {
  return (
    <Suspense>
      <div className="px-8 py-6 space-y-6">
        {/* Greeting header + CTAs */}
        <DashboardGreeting />

        {/* Stat cards grid */}
        <DashboardStatCards />

        {/* 2-column widget layout: 2/3 recent activity + 1/3 top viewed/tags */}
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
