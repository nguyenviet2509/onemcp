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
// Uses CSS var tokens for theme-awareness (bg-card, text-foreground, text-muted-foreground).
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {loading || value === null ? (
          <Skeleton className="mt-1.5 h-8 w-14" />
        ) : (
          <p className={cn('mt-0.5 text-3xl font-semibold leading-tight text-foreground', valueColor)}>
            {value}
          </p>
        )}
        {subtext && !loading && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
        )}
      </CardContent>
    </Card>
  );
}
