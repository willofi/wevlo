import { notFound } from "next/navigation";

import { WorkspaceProjectsSurface } from "@/components/workspace-projects-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getRequestStatus } from "@/lib/request-error";
import { getProjectsForWorkspace, getWorkspaceBySlug, listWorkspaces } from "@/lib/server-api";

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

  const [authSession, projects, workspaces] = await Promise.all([
    requireCurrentAuthSession(`/${workspace.slug}`),
    getProjectsForWorkspace(workspace.slug),
    listWorkspaces()
  ]);

  return (
    <WorkspaceProjectsSurface
      projects={projects}
      viewer={{
        email: authSession?.userEmail ?? null,
        name: authSession?.userName ?? "Workspace member"
      }}
      workspace={workspace}
      workspaces={workspaces}
    />
  );
}
