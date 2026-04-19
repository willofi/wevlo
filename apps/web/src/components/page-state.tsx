import type { CSSProperties, ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle, cn } from "@wevlo/ui-web";

export type PageStateTone = "neutral" | "warning" | "error";

type PageStateProps = {
  actions?: ReactNode;
  body: ReactNode;
  eyebrow?: string;
  title: string;
  tone?: PageStateTone;
};

const toneStyles: Record<PageStateTone, string> = {
  neutral: "border-border/70 bg-card/90",
  warning: "border-amber-500/35 bg-amber-500/10",
  error: "border-red-500/35 bg-red-500/10"
};

export const PageState = ({ actions, body, eyebrow, title, tone = "neutral" }: PageStateProps) => {
  return (
    <Card className={cn("shadow-none", toneStyles[tone])}>
      <CardHeader className="space-y-3">
        {eyebrow ? <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div> : null}
        <CardTitle className="text-2xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-7 text-muted-foreground">
        <div>{body}</div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
};

export const pageStateButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90";

export const pageStateLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-border bg-background/50 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70";

export const pageStateButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid hsl(var(--border))",
  padding: "10px 16px",
  background: "hsl(var(--primary))",
  color: "hsl(var(--primary-foreground))",
  textDecoration: "none",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};

export const pageStateLinkStyle: CSSProperties = {
  borderRadius: 999,
  border: "1px solid hsl(var(--border))",
  padding: "10px 16px",
  background: "transparent",
  color: "hsl(var(--foreground))",
  textDecoration: "none",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
};
