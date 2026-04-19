import type { ReactNode } from "react";

type PrototypeEmptyStateProps = {
  action?: ReactNode;
  eyebrow?: string;
  description: string;
  title: string;
};

export function PrototypeEmptyState({
  action,
  eyebrow,
  description,
  title
}: PrototypeEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-card/35 px-6 py-10 text-center">
      {eyebrow ? <div className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
      <h2 className="mt-3 text-xl font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
