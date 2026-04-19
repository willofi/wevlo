import { notFound } from "next/navigation";

import { ProjectAccessSurface } from "@/components/project-access-surface";
import { getAppShellData } from "@/lib/app-shell-data";
import {
  getProjectMembers,
  getProjectsForWorkspace,
  getProjectByKey,
  getWorkspaceBySlug,
  getWorkspaceMembers
} from "@/lib/server-api";

type ProjectAccessPageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function ProjectAccessPage({ params }: ProjectAccessPageProps) {
  const { projectKey, workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const project = await getProjectByKey(workspace.slug, projectKey);

  if (!project) {
    notFound();
  }

  const [projects, workspaceMembers, projectMembers] = await Promise.all([
    getProjectsForWorkspace(workspace.slug),
    getWorkspaceMembers(workspace.slug),
    getProjectMembers(workspace.slug, project.key)
  ]);
  const shellData = await getAppShellData();

  return (
    <ProjectAccessSurface
      initialMembers={projectMembers}
      project={project}
      projects={projects}
      shellViewer={shellData.viewer}
      shellWorkspaces={shellData.workspaces}
      workspace={workspace}
      workspaceMembers={workspaceMembers}
    />
  );
}
