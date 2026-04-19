import { notFound } from "next/navigation";

import { MyIssuesSurface } from "@/components/my-issues-surface";
import { getAppShellData } from "@/lib/app-shell-data";
import { getRequestStatus } from "@/lib/request-error";
import {
  getIssuesForProject,
  getProjectsForWorkspace,
  getWorkspaceBySlug
} from "@/lib/server-api";

type MyIssuesPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

const getSafeIssuesForProject = async (
  workspaceSlug: string,
  projectKey: string,
  scope: "all" | "assigned" | "created"
) => {
  try {
    return await getIssuesForProject(workspaceSlug, projectKey, scope);
  } catch (error) {
    const status = getRequestStatus(error);

    if (status === 404 || status === 401 || status === 403) {
      return [];
    }

    throw error;
  }
};

export default async function MyIssuesPage({ params }: MyIssuesPageProps) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const [projects, shellData] = await Promise.all([
    getProjectsForWorkspace(workspace.slug),
    getAppShellData()
  ]);

  const [assignedByProject, createdByProject, allByProject] = await Promise.all([
    Promise.all(projects.map(async (project) => getSafeIssuesForProject(workspace.slug, project.key, "assigned"))),
    Promise.all(projects.map(async (project) => getSafeIssuesForProject(workspace.slug, project.key, "created"))),
    Promise.all(projects.map(async (project) => getSafeIssuesForProject(workspace.slug, project.key, "all")))
  ]);

  const projectKeyById = Object.fromEntries(projects.map((project) => [project.id, project.key]));
  const assignedIssues = assignedByProject.flat().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const createdIssues = createdByProject.flat().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const recentIssues = allByProject.flat().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 20);

  return (
    <MyIssuesSurface
      assignedIssues={assignedIssues}
      createdIssues={createdIssues}
      recentIssues={recentIssues}
      projectKeyById={projectKeyById}
      viewer={shellData.viewer}
      workspaceName={workspace.name}
      workspaceSlug={workspace.slug}
      workspaces={shellData.workspaces}
    />
  );
}
