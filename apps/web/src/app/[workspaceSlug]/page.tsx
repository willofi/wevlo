import { notFound } from "next/navigation";

import { WorkspaceProjectsSurface } from "@/components/workspace-projects-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getRequestStatus } from "@/lib/request-error";
import { getMe, getProjectsForWorkspace, getWorkspaceBySlug, getWorkspaceMembers, listWorkspaces } from "@/lib/server-api";

type WorkspacePageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceSlug } = await params;
  let workspace;

  try {
    workspace = await getWorkspaceBySlug(workspaceSlug);
  } catch (error) {
    if (getRequestStatus(error) === 401 || getRequestStatus(error) === 403) {
      notFound();
    }

    throw error;
  }

  if (!workspace) {
    notFound();
  }

  const [, me, projects, workspaceMembers, workspaces] = await Promise.all([
    requireCurrentAuthSession(`/${workspace.slug}`),
    getMe(),
    getProjectsForWorkspace(workspace.slug),
    getWorkspaceMembers(workspace.slug),
    listWorkspaces()
  ]);

  return (
    <WorkspaceProjectsSurface
      projects={projects}
      viewer={{
        avatarUrl: me.user.avatarUrl,
        email: me.user.email,
        name: me.user.name
      }}
      workspace={workspace}
      workspaceMembers={workspaceMembers}
      workspaces={workspaces}
    />
  );
}
