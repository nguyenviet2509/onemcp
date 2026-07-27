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

// Option A stat card: label xs uppercase tracking-wider muted, number 26px font-semibold tracking-tight.
export function DashboardStatCard({
  label,
  value,
  subtext,
  valueColor,
  loading,
}: DashboardStatCardProps) {
  return (
    <Card>
      <CardContent>
        {/* Section label — 10px uppercase tracking-wider per Option A */}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {loading || value === null ? (
          <Skeleton className="mt-2 h-8 w-14" />
        ) : (
          <p className={cn('mt-1.5 text-[26px] font-semibold leading-none tracking-tight text-foreground', valueColor)}>
            {value.toLocaleString()}
          </p>
        )}
        {subtext && !loading && (
          <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
