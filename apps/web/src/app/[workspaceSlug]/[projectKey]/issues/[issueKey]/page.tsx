import { notFound } from "next/navigation";

import { IssueDetailPageSurface } from "@/components/issue-detail-page-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { loadProjectShellPageData } from "@/lib/project-shell-page";
import { getIssueByKey, getMe, getWorkspaceMembers, listWorkspaces } from "@/lib/server-api";

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
  const [, me, issue, workspaceMembers, workspaces] = await Promise.all([
    requireCurrentAuthSession(`/${workspace.slug}/${project.key}/issues/${issueKey}`),
    getMe(),
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
        avatarUrl: me.user.avatarUrl,
        email: me.user.email ?? null,
        id: me.user.id,
        name: me.user.name
      }}
      workspace={workspace}
      workspaceMembers={workspaceMembers}
      workspaces={workspaces}
    />
  );
}
