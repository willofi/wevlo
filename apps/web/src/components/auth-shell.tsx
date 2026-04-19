import type { PropsWithChildren, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wevlo/ui-web";

type AuthShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}>;

export const AuthShell = ({ aside, children, subtitle, title }: AuthShellProps) => {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10 text-foreground sm:px-8">
      <section className="grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <Card className="border-border/70 bg-card/90 shadow-2xl shadow-black/20">
          <CardHeader className="space-y-4 pb-6">
            <div className="text-xs tracking-[0.3em] text-muted-foreground">WEVLO</div>
            <div className="space-y-3">
              <CardTitle className="text-4xl tracking-tight">{title}</CardTitle>
              {subtitle ? <CardDescription className="max-w-2xl text-base">{subtitle}</CardDescription> : null}
            </div>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {aside ? (
          <Card className="border-border/70 bg-background/75">
            <CardContent className="p-6">{aside}</CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
};
