import { notFound } from "next/navigation";

import { ProjectIntegrationsSurface } from "@/components/project-integrations-surface";
import { getAppShellData } from "@/lib/app-shell-data";
import {
  getProjectByKey,
  getProjectIntegrations,
  getProjectsForWorkspace,
  getWorkspaceBySlug,
  getWorkspaceIntegrations
} from "@/lib/server-api";

type ProjectIntegrationsPageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function ProjectIntegrationsPage({ params }: ProjectIntegrationsPageProps) {
  const { projectKey, workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const project = await getProjectByKey(workspace.slug, projectKey);

  if (!project) {
    notFound();
  }

  const [projects, integrations, projectIntegrations, shellData] = await Promise.all([
    getProjectsForWorkspace(workspace.slug),
    getWorkspaceIntegrations(workspace.slug),
    getProjectIntegrations(workspace.slug, project.key),
    getAppShellData()
  ]);

  return (
    <ProjectIntegrationsSurface
      initialInstallations={integrations}
      initialLinks={projectIntegrations.links}
      initialSyncStatuses={projectIntegrations.syncStatuses}
      project={project}
      projects={projects}
      shellViewer={shellData.viewer}
      shellWorkspaces={shellData.workspaces}
      workspace={workspace}
    />
  );
}
