import Link from 'next/link';

const PORTAL_VERSION = 'v1.5';

// Brand block: small square mark + wordmark + version.
// Identity moved to SidebarUserCard at bottom to avoid duplication.
export function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-3.5 py-3.5">
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-md bg-foreground text-[11px] font-bold tracking-tight text-background"
      >
        O
      </span>
      <Link
        href="/"
        className="min-w-0 flex-1 leading-tight"
        aria-label="OneMCP home"
      >
        <span className="block text-sm font-semibold text-sidebar-foreground">OneMCP</span>
        <span className="block text-[11px] text-muted-foreground">{PORTAL_VERSION}</span>
      </Link>
    </div>
  );
}
