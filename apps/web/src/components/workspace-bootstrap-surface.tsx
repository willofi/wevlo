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
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/50">
            <div className="grid grid-cols-[minmax(0,1.6fr)_180px_120px] gap-4 border-b border-border/80 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <div>Workspace</div>
              <div>Slug</div>
              <div className="text-right">Created</div>
            </div>
            <div className="grid">
              {workspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={getWorkspaceHref(workspace.slug)}
                  className="grid grid-cols-[minmax(0,1.6fr)_180px_120px] gap-4 border-b border-border/80 px-5 py-4 transition-colors last:border-b-0 hover:bg-secondary/35"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{workspace.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Open workspace and project list</div>
                  </div>
                  <div className="font-mono text-sm text-muted-foreground">{workspace.slug}</div>
                  <div className="text-right text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(workspace.createdAt))}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </PrototypeShell>

      <CreateWorkspaceDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}
