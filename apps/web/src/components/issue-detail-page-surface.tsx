"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { IssueDetailDto, ProjectSummaryDto, WorkspaceMemberDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import { Button } from "@wevlo/ui-web";

import { PrototypeShell } from "@/components/prototype-shell";
import { IssueDetailEditor } from "@/components/issue-detail-editor";
import { getProjectHref } from "@/lib/issue-hub-data";
import { buildUserDirectory } from "@/lib/user-directory";

type IssueDetailPageSurfaceProps = {
  issue: IssueDetailDto;
  project: ProjectSummaryDto;
  projects: ProjectSummaryDto[];
  viewer: {
    email?: string | null;
    id: string;
    name: string;
  };
  workspace: WorkspaceSummaryDto;
  workspaceMembers: WorkspaceMemberDto[];
  workspaces: WorkspaceSummaryDto[];
};

export function IssueDetailPageSurface({
  issue,
  project,
  projects,
  viewer,
  workspace,
  workspaceMembers,
  workspaces
}: IssueDetailPageSurfaceProps) {
  const [currentIssue, setCurrentIssue] = useState(issue);
  const userDirectory = buildUserDirectory(workspaceMembers);

  return (
    <PrototypeShell
      currentProjectKey={project.key}
      currentWorkspaceSlug={workspace.slug}
      projects={projects}
      viewer={viewer}
      workspaceActionsContext={{
        currentProjectKey: project.key,
        projects,
        workspaceMembers,
        workspaceSlug: workspace.slug
      }}
      workspaces={workspaces.map((candidate) => ({ name: candidate.name, slug: candidate.slug }))}
      header={(
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {workspace.name} / {project.name}
            </div>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground">{currentIssue.issueKey}</h1>
              <p className="text-sm text-muted-foreground">{currentIssue.title}</p>
            </div>
          </div>
          <Button asChild variant="ghost">
            <Link href={getProjectHref(workspace.slug, project.key)}>
              <ArrowLeft className="size-4" />
              Back to project
            </Link>
          </Button>
        </div>
      )}
    >
      <IssueDetailEditor
        issue={currentIssue}
        mode="page"
        onIssueUpdated={setCurrentIssue}
        projectKey={project.key}
        userDirectory={userDirectory}
        viewerUserId={viewer.id}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspace.slug}
      />
    </PrototypeShell>
  );
}
