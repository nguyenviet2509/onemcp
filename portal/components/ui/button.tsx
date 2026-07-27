import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Option A — Linear-style buttons.
// primary: inverted (bg=foreground, text=background). secondary: flat + border-strong.
// ghost: transparent bg, dim text. No heavy shadows.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border text-[13px] font-medium whitespace-nowrap transition-all duration-100 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/15 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // bg = text color, text = bg color (inverted per Option A)
        default:
          "border-foreground bg-foreground text-background hover:opacity-90",
        outline:
          "border-border bg-background text-foreground hover:bg-muted",
        secondary:
          "border-border bg-background text-foreground hover:bg-muted",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        xs:      "h-6 rounded px-2 text-xs",
        sm:      "h-7 px-2.5 text-xs",
        lg:      "h-9 px-4",
        icon:    "size-8",
        "icon-xs": "size-6 rounded",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
