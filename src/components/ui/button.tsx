import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-sans text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-paper hover:bg-ink/90 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-100/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-ink/25 text-ink hover:bg-ink/5 dark:border-white/20 dark:text-stone-200 dark:hover:bg-white/5",
        secondary:
          "bg-ink/[0.06] text-ink hover:bg-ink/10 dark:bg-white/10 dark:text-stone-200 dark:hover:bg-white/15",
        ghost:
          "text-ink hover:bg-ink/5 dark:text-stone-200 dark:hover:bg-white/5",
        link: "text-ink underline underline-offset-2 hover:text-ink-soft",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
