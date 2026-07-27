import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // ── Existing shadcn variants ──────────────────────────────────────────
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",

        // ── NEW semantic status variants ──────────────────────────────────────
        // Published: emerald tone — WCAG AA verified (emerald-400 on emerald-500/15 bg)
        "status-published":
          "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
        // Pending: amber tone
        "status-pending":
          "border-amber-500/30 bg-amber-500/15 text-amber-400",
        // Rejected: rose tone
        "status-rejected":
          "border-rose-500/30 bg-rose-500/15 text-rose-400",
        // Archived: slate muted tone
        "status-archived":
          "border-slate-500/30 bg-slate-500/15 text-slate-400",
        // Template: neutral slate outline
        template:
          "border-slate-500/30 bg-slate-500/15 text-slate-300",
        // Tag: neutral, hover to primary accent
        tag:
          "border-slate-500/20 bg-slate-500/10 text-slate-400 hover:border-primary/30 hover:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Export BadgeVariant type for use in status-pill-variants.ts helper
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
