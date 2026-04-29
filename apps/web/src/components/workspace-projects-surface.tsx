"use client";

import Link from "next/link";
import { useState } from "react";

import type { ProjectSummaryDto, WorkspaceMemberDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import { Badge, Button } from "@wevlo/ui-web";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { PrototypeEmptyState } from "@/components/prototype-empty-state";
import { PrototypeShell } from "@/components/prototype-shell";
import { getProjectHref } from "@/lib/issue-hub-data";
import { useWorkspaceProjectsQuery } from "@/lib/query-hooks";

type WorkspaceProjectsSurfaceProps = {
  projects: ProjectSummaryDto[];
  viewer: {
    avatarUrl?: string | null;
    email?: string | null;
    name: string;
  };
  workspace: WorkspaceSummaryDto;
  workspaceMembers: WorkspaceMemberDto[];
  workspaces: WorkspaceSummaryDto[];
};

export function WorkspaceProjectsSurface({
  projects,
  viewer,
  workspace,
  workspaceMembers,
  workspaces
}: WorkspaceProjectsSurfaceProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const projectsQuery = useWorkspaceProjectsQuery(workspace.slug, {
    initialData: projects
  });
  const visibleProjects = projectsQuery.data ?? projects;

  return (
    <>
      <PrototypeShell
        currentWorkspaceSlug={workspace.slug}
        projects={visibleProjects}
        viewer={viewer}
        workspaceActionsContext={{
          projects: visibleProjects,
          workspaceMembers,
          workspaceSlug: workspace.slug
        }}
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
        {visibleProjects.length === 0 ? (
          <PrototypeEmptyState
            eyebrow="Workspace ready"
            title="No project yet"
            description="Create the first project in this workspace, then start capturing issues inside it."
            action={<Button onClick={() => setIsCreateOpen(true)}>Create project</Button>}
          />
        ) : (
          <div className="grid gap-3">
            {visibleProjects.map((project) => (
              <Link
                key={project.id}
                href={getProjectHref(workspace.slug, project.key)}
                className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-border/60 bg-card/40 p-5 transition-all hover:border-border hover:bg-secondary/20 hover:shadow-sm"
              >
                <div className="flex items-center gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/60 bg-background font-mono text-sm font-bold text-muted-foreground group-hover:border-primary/20 group-hover:text-primary transition-colors">
                    {project.key}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">{project.name}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="default" className="px-1.5 py-0 text-[10px] uppercase tracking-wider font-semibold bg-background/50 border-border/40">
                        {project.currentUserRole}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground/60">•</span>
                      <span className="text-xs text-muted-foreground">{project.visibility === "private" ? "Private" : "Public"} Project</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    Open
                  </span>
                </div>
              </Link>
            ))}
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
