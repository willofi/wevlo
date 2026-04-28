"use client";

import Link from "next/link";
import { useState } from "react";

import type { WorkspaceSummaryDto } from "@wevlo/contracts";
import { Button } from "@wevlo/ui-web";

import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { PrototypeEmptyState } from "@/components/prototype-empty-state";
import { PrototypeShell } from "@/components/prototype-shell";
import { getWorkspaceHref } from "@/lib/issue-hub-data";

type WorkspaceBootstrapSurfaceProps = {
  viewer: {
    avatarUrl?: string | null;
    email?: string | null;
    name: string;
  };
  workspaces: WorkspaceSummaryDto[];
};

export function WorkspaceBootstrapSurface({
  viewer,
  workspaces
}: WorkspaceBootstrapSurfaceProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <>
      <PrototypeShell
        viewer={viewer}
        workspaces={workspaces.map((workspace) => ({ name: workspace.name, slug: workspace.slug }))}
        header={(
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Workspace bootstrap
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">Choose a workspace</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Start by opening a company workspace, or create a new one if this is your first pass through the prototype.
              </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>New workspace</Button>
          </div>
        )}
      >
        {workspaces.length === 0 ? (
          <PrototypeEmptyState
            eyebrow="First-time setup"
            title="No workspace yet"
            description="Create the first workspace to start organizing projects and issues."
            action={<Button onClick={() => setIsCreateOpen(true)}>Create workspace</Button>}
          />
        ) : (
          <div className="grid gap-3">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={getWorkspaceHref(workspace.slug)}
                className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-border/60 bg-card/40 p-5 transition-all hover:border-border hover:bg-secondary/20 hover:shadow-sm"
              >
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-background font-bold text-muted-foreground group-hover:border-primary/20 group-hover:text-primary transition-colors">
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{workspace.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{workspace.slug}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="hidden sm:block text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Created at</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(workspace.createdAt))}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="group-hover:bg-primary/10 group-hover:text-primary">
                    Open
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PrototypeShell>

      <CreateWorkspaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}
