"use client";

import { cloneElement, createContext, isValidElement, type ComponentPropsWithoutRef, type ReactElement, type ReactNode, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "../../lib/utils";

type TooltipContextValue = {
  contentId: string;
  delayDuration: number;
  open: boolean;
  setOpen: (open: boolean) => void;
};

const TooltipContext = createContext<TooltipContextValue | null>(null);

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function Tooltip({ children, delayDuration = 120 }: { children: ReactNode; delayDuration?: number }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const value = useMemo(() => ({ contentId, delayDuration, open, setOpen }), [contentId, delayDuration, open]);

  return (
    <TooltipContext.Provider value={value}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({
  asChild = false,
  children
}: {
  asChild?: boolean;
  children: ReactNode;
}) {
  const context = useContext(TooltipContext);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!context) {
    return children;
  }

  const clearTimer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const show = () => {
    clearTimer();
    timeoutRef.current = window.setTimeout(() => context.setOpen(true), context.delayDuration);
  };

  const hide = () => {
    clearTimer();
    context.setOpen(false);
  };

  const triggerProps = {
    "aria-describedby": context.open ? context.contentId : undefined,
    onBlur: hide,
    onFocus: show,
    onPointerEnter: show,
    onPointerLeave: hide
  };

  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement, triggerProps as never);
  }

  return (
    <span {...triggerProps} className="inline-flex">
      {children}
    </span>
  );
}

type TooltipContentProps = ComponentPropsWithoutRef<"div"> & {
  side?: "top" | "right" | "bottom" | "left";
};

const contentSideClasses: Record<NonNullable<TooltipContentProps["side"]>, string> = {
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2"
};

export function TooltipContent({
  className,
  side = "top",
  ...props
}: TooltipContentProps) {
  const context = useContext(TooltipContext);
  if (!context || !context.open) {
    return null;
  }

  return (
    <div
      id={context.contentId}
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-50 max-w-[18rem] rounded-md border border-border/70 bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg",
        contentSideClasses[side],
        className
      )}
      {...props}
    />
  );
}
