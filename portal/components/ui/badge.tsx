import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Option A — Linear-style chip/badge: radius-4px (NOT pill), 1px 8px padding, 11px text.
// NO rounded-full. Uses rounded (4px via --radius/2 approx).
const badgeVariants = cva(
  "group/badge inline-flex h-[20px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded border px-2 py-px text-[11px] font-medium whitespace-nowrap transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Neutral chip — panel-2 bg, border-strong, dim text
        default:
          "border-border bg-muted text-muted-foreground",
        secondary:
          "border-border bg-muted text-muted-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        outline:
          "border-border bg-transparent text-muted-foreground",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-muted",
        link:
          "border-transparent text-primary underline-offset-4 hover:underline",

        // Semantic status variants — Option A color scheme
        "status-published":
          "border-transparent bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
        "status-pending":
          "border-transparent bg-amber-500/12 text-amber-600 dark:text-amber-400",
        "status-rejected":
          "border-transparent bg-rose-500/12 text-rose-600 dark:text-rose-400",
        "status-archived":
          "border-transparent bg-muted text-muted-foreground",
        // Template type chip — mono, subtle
        template:
          "border-border bg-muted font-mono text-muted-foreground",
        // Tag chip — clickable, hover accent
        tag:
          "border-border bg-muted text-muted-foreground hover:border-primary/30 hover:text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

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
      { className: cn(badgeVariants({ variant }), className) },
      props
    ),
    render,
    state: { slot: "badge", variant },
  })
}

export { Badge, badgeVariants }
