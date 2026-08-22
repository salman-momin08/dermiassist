import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-400 text-white shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 border border-white/10",
        gradient:
          "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/35 border border-white/10",
        glow:
          "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(37,99,235,0.35)] hover:shadow-[0_0_28px_rgba(37,99,235,0.55)] border border-primary/40",
        destructive:
          "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-500/25 hover:shadow-lg hover:shadow-red-500/35 border border-white/10",
        outline:
          "border border-border/80 bg-background/60 hover:bg-accent/80 hover:border-primary/50 text-foreground backdrop-blur-md shadow-sm hover:shadow",
        secondary:
          "bg-secondary/80 hover:bg-secondary text-secondary-foreground backdrop-blur-sm border border-border/40 shadow-sm",
        ghost:
          "hover:bg-accent/70 hover:text-accent-foreground rounded-lg",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto font-semibold",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8.5 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-base font-semibold",
        xl: "h-12 rounded-2xl px-8 text-base font-bold shadow-lg",
        icon: "h-9 w-9 rounded-xl",
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
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

