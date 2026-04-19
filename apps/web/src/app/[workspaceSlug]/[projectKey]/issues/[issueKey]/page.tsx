import { notFound } from "next/navigation";

import { IssueDetailPageSurface } from "@/components/issue-detail-page-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { loadProjectShellPageData } from "@/lib/project-shell-page";
import { getIssueByKey, getWorkspaceMembers, listWorkspaces } from "@/lib/server-api";

type IssueDetailPageProps = {
  params: Promise<{
    issueKey: string;
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { issueKey, projectKey, workspaceSlug } = await params;
  const result = await loadProjectShellPageData({
    includeIssues: false,
    projectKey,
    surface: "issue",
    workspaceSlug
  });

  if (result.kind === "not_found") {
    notFound();
  }

  if (result.kind === "state") {
    return result.node;
  }

  const { project, projects, workspace } = result.data;
  const [authSession, issue, workspaceMembers, workspaces] = await Promise.all([
    requireCurrentAuthSession(`/${workspace.slug}/${project.key}/issues/${issueKey}`),
    getIssueByKey(workspace.slug, project.key, issueKey),
    getWorkspaceMembers(workspace.slug),
    listWorkspaces()
  ]);

  if (!issue) {
    notFound();
  }

  return (
    <IssueDetailPageSurface
      issue={issue}
      project={project}
      projects={projects}
      viewer={{
        email: authSession.userEmail ?? null,
        name: authSession.userName ?? "Workspace member"
      }}
      workspace={workspace}
      workspaceMembers={workspaceMembers}
      workspaces={workspaces}
    />
  );
}
