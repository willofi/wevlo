import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "./lib/utils";

type AppShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  sidebar?: ReactNode;
}>;

export const AppShell = ({ children, sidebar, subtitle, title }: AppShellProps) => {
  return (
    <div className="min-h-screen text-foreground lg:grid lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b border-border/70 bg-background/70 px-5 py-5 backdrop-blur lg:sticky lg:top-0 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
        <div className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm shadow-black/10">
          <div className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">WEVLO</div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
        </div>
        {sidebar ? <div className="mt-6 space-y-6">{sidebar}</div> : null}
      </aside>
      <main className={cn("min-w-0 px-5 py-6 sm:px-8 sm:py-8 lg:px-10")}>{children}</main>
    </div>
  );
};
