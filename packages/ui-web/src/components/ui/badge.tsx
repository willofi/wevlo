import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border/80 bg-secondary text-secondary-foreground",
        outline: "border-border bg-background text-foreground",
        info: "border-sky-500/30 bg-sky-500/10 text-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-foreground",
        warning: "border-amber-500/30 bg-amber-500/10 text-foreground",
        danger: "border-red-500/30 bg-red-500/10 text-foreground",
        muted: "border-border/70 bg-muted text-muted-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ className, variant }))} {...props} />;
}

export { badgeVariants };
