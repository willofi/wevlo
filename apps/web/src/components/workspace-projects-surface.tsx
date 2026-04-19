"use client";

import Link from "next/link";
import { useState } from "react";

import type { ProjectSummaryDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import { Badge, Button } from "@wevlo/ui-web";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { PrototypeEmptyState } from "@/components/prototype-empty-state";
import { PrototypeShell } from "@/components/prototype-shell";
import { getProjectHref } from "@/lib/issue-hub-data";

type WorkspaceProjectsSurfaceProps = {
  projects: ProjectSummaryDto[];
  viewer: {
    email?: string | null;
    name: string;
  };
  workspace: WorkspaceSummaryDto;
  workspaces: WorkspaceSummaryDto[];
};

export function WorkspaceProjectsSurface({
  projects,
  viewer,
  workspace,
  workspaces
}: WorkspaceProjectsSurfaceProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <>
      <PrototypeShell
        currentWorkspaceSlug={workspace.slug}
        projects={projects}
        viewer={viewer}
        workspaces={workspaces.map((candidate) => ({ name: candidate.name, slug: candidate.slug }))}
        header={(
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Workspace
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-foreground">{workspace.name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Projects are the first real working surface in this prototype. Create one, then move into the issue shell.
              </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)}>New project</Button>
          </div>
        )}
      >
        {projects.length === 0 ? (
          <PrototypeEmptyState
            eyebrow="Workspace ready"
            title="No project yet"
            description="Create the first project in this workspace, then start capturing issues inside it."
            action={<Button onClick={() => setIsCreateOpen(true)}>Create project</Button>}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/50">
            <div className="grid grid-cols-[120px_minmax(0,1.4fr)_120px_120px] gap-4 border-b border-border/80 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <div>Key</div>
              <div>Project</div>
              <div>Role</div>
              <div className="text-right">Visibility</div>
            </div>
            <div className="grid">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={getProjectHref(workspace.slug, project.key)}
                  className="grid grid-cols-[120px_minmax(0,1.4fr)_120px_120px] gap-4 border-b border-border/80 px-5 py-4 transition-colors last:border-b-0 hover:bg-secondary/35"
                >
                  <div className="font-mono text-sm text-muted-foreground">{project.key}</div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{project.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Open list and board views</div>
                  </div>
                  <div className="text-sm text-muted-foreground">{project.currentUserRole}</div>
                  <div className="flex justify-end">
                    <Badge variant="outline" className="rounded-full border-border/80 bg-background/70">
                      {project.visibility}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </PrototypeShell>

      <CreateProjectDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        workspaceSlug={workspace.slug}
      />
    </>
  );
}
