"use client";

import Link from "next/link";
import type { PropsWithChildren, ReactNode } from "react";

import type { ProjectSummaryDto } from "@wevlo/contracts";
import { Avatar, AvatarFallback, ScrollArea, Separator, cn } from "@wevlo/ui-web";

type ShellWorkspace = {
  name: string;
  slug: string;
};

type ShellViewer = {
  email?: string | null;
  name: string;
};

type PrototypeShellProps = PropsWithChildren<{
  currentProjectKey?: string;
  currentWorkspaceSlug?: string;
  footer?: ReactNode;
  header?: ReactNode;
  inspector?: ReactNode;
  projects?: ProjectSummaryDto[];
  viewer: ShellViewer;
  workspaces: ShellWorkspace[];
}>;

function initialsFromName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "W") + (parts[1]?.[0] ?? "");
}

export function PrototypeShell({
  children,
  currentProjectKey,
  currentWorkspaceSlug,
  footer,
  header,
  inspector,
  projects = [],
  viewer,
  workspaces
}: PrototypeShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border/80 bg-[#090b10] lg:flex lg:flex-col">
          <div className="px-4 py-4">
            <Link href="/" className="block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-muted-foreground">WEVLO</div>
              <div className="mt-2 text-sm font-medium text-foreground">Issue hub prototype</div>
            </Link>
          </div>

          <Separator />

          <ScrollArea className="flex-1">
            <div className="grid gap-6 px-3 py-4">
              <section>
                <div className="px-2 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Workspaces
                </div>
                <div className="mt-2 grid gap-1">
                  {workspaces.map((workspace) => (
                    <Link
                      key={workspace.slug}
                      href={`/${workspace.slug}`}
                      className={cn(
                        "rounded-md px-2.5 py-2 text-sm transition-colors",
                        workspace.slug === currentWorkspaceSlug
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      )}
                    >
                      <div className="truncate font-medium">{workspace.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{workspace.slug}</div>
                    </Link>
                  ))}
                </div>
              </section>

              {currentWorkspaceSlug ? (
                <section>
                  <div className="px-2 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Projects
                  </div>
                  <div className="mt-2 grid gap-1">
                    {projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/${currentWorkspaceSlug}/${project.key}`}
                        className={cn(
                          "rounded-md px-2.5 py-2 text-sm transition-colors",
                          project.key === currentProjectKey
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
                          <span className="truncate font-medium">{project.name}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{project.currentUserRole}</div>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </ScrollArea>

          <Separator />

          <div className="px-3 py-3">
            <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-card/70 px-3 py-3">
              <Avatar className="size-9 border border-border/80 bg-secondary/60">
                <AvatarFallback className="bg-transparent text-xs font-semibold text-foreground">
                  {initialsFromName(viewer.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{viewer.name}</div>
                <div className="truncate text-xs text-muted-foreground">{viewer.email ?? "Authenticated session"}</div>
              </div>
            </div>
            {footer ? <div className="mt-3">{footer}</div> : null}
          </div>
        </aside>

        <div className="grid min-h-screen grid-rows-[auto_minmax(0,1fr)]">
          {header ? (
            <header className="border-b border-border/80 bg-background/95 px-4 py-4 backdrop-blur lg:px-8">
              {header}
            </header>
          ) : null}
          <div className={cn("grid min-h-0", inspector ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1")}>
            <main className="min-w-0 px-4 py-5 lg:px-8 lg:py-6">{children}</main>
            {inspector ? (
              <aside className="hidden min-h-0 border-l border-border/80 bg-[#0b0d12] xl:block">
                {inspector}
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
