import type { HTMLAttributes, ImgHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Avatar({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("relative flex size-9 shrink-0 overflow-hidden rounded-full bg-muted", className)} {...props} />;
}

export function AvatarImage({ className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img className={cn("aspect-square size-full object-cover", className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("flex size-full items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}
