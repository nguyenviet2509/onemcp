import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStatCardProps {
  label: string;
  value: number | null;
  subtext?: string;
  /** Tailwind color class for the value number, e.g. 'text-amber-400' */
  valueColor?: string;
  loading?: boolean;
}

// Single stat card primitive — muted uppercase label + big number + optional subtext.
// Dark-first: bg-slate-900 border-slate-800, label slate-500, value slate-100.
export function DashboardStatCard({
  label,
  value,
  subtext,
  valueColor,
  loading,
}: DashboardStatCardProps) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="pt-5 pb-4 px-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        {loading || value === null ? (
          <Skeleton className="mt-2 h-9 w-16" />
        ) : (
          <p className={cn('mt-1 text-4xl font-semibold text-slate-100', valueColor)}>
            {value}
          </p>
        )}
        {subtext && !loading && (
          <p className="mt-1 text-xs text-slate-500">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
