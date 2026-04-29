import { notFound } from "next/navigation";

import { ProjectShellSurface } from "@/components/project-shell-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { loadProjectShellPageData } from "@/lib/project-shell-page";
import { getMe, getWorkspaceMembers, listWorkspaces } from "@/lib/server-api";

type ProjectPageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
  searchParams: Promise<{
    compose?: string;
    issue?: string;
    scope?: "all" | "assigned" | "created";
    view?: "list" | "board";
  }>;
};

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { projectKey, workspaceSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const result = await loadProjectShellPageData({
    projectKey,
    surface: "issues",
    workspaceSlug,
    ...(resolvedSearchParams.scope ? { scope: resolvedSearchParams.scope } : {})
  });

  if (result.kind === "not_found") {
    notFound();
  }

  if (result.kind === "state") {
    return result.node;
  }

  const { issues, project, projects, workspace } = result.data;
  const [, me, workspaces, workspaceMembers] = await Promise.all([
    requireCurrentAuthSession(`/${workspace.slug}/${project.key}`),
    getMe(),
    listWorkspaces(),
    getWorkspaceMembers(workspace.slug)
  ]);

  return (
    <ProjectShellSurface
      initialComposeOpen={resolvedSearchParams.compose === "1"}
      initialIssues={issues}
      initialScope={resolvedSearchParams.scope ?? "all"}
      initialView={resolvedSearchParams.view === "board" ? "board" : "list"}
      project={project}
      projects={projects}
      viewer={{
        avatarUrl: me.user.avatarUrl,
        email: me.user.email,
        id: me.user.id,
        name: me.user.name
      }}
      workspace={workspace}
      workspaceMembers={workspaceMembers}
      workspaces={workspaces}
      {...(resolvedSearchParams.issue ? { initialIssueKey: resolvedSearchParams.issue } : {})}
    />
  );
}
