import type { ReactNode } from "react";

import type { IssueListItemDto, ProjectSummaryDto, WorkspaceSummaryDto } from "@wevlo/contracts";

import { ShellPageState } from "@/components/shell-page-state";
import {
  getIssueSummariesForProject,
  getProjectByKey,
  getProjectsForWorkspace,
  getWorkspaceBySlug
} from "@/lib/server-api";
import { getRequestStatus } from "@/lib/request-error";

type ProjectSurface = "issues" | "board" | "triage" | "issue";

type LoadedProjectShellData = {
  issues: IssueListItemDto[];
  project: ProjectSummaryDto;
  projects: ProjectSummaryDto[];
  workspace: WorkspaceSummaryDto;
};

type ProjectShellLoadResult =
  | {
      data: LoadedProjectShellData;
      kind: "ok";
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "state";
      node: ReactNode;
    };

const projectSurfaceCopy: Record<ProjectSurface, { deniedEyebrow: string; deniedTitle: (projectKey: string) => string; workspaceTitle: string }> = {
  board: {
    deniedEyebrow: "Project board",
    deniedTitle: (projectKey) => `You do not have access to ${projectKey}`,
    workspaceTitle: "This project board is not available to your account"
  },
  issue: {
    deniedEyebrow: "Issue access",
    deniedTitle: (projectKey) => `You do not have access to ${projectKey}`,
    workspaceTitle: "This issue is not available to your account"
  },
  issues: {
    deniedEyebrow: "Project access",
    deniedTitle: (projectKey) => `You do not have access to ${projectKey}`,
    workspaceTitle: "This project is not available to your account"
  },
  triage: {
    deniedEyebrow: "Project triage",
    deniedTitle: (projectKey) => `You do not have access to ${projectKey}`,
    workspaceTitle: "This project triage queue is not available to your account"
  }
};

const renderProjectState = async (input: {
  body: string;
  eyebrow: string;
  projectKey?: string;
  title: string;
  workspaceSlug: string;
}) =>
  ShellPageState({
    tone: "warning",
    eyebrow: input.eyebrow,
    title: input.title,
    shellTitle: input.projectKey ? `${input.projectKey} unavailable` : "Workspace unavailable",
    shellSubtitle: "Return home or switch context without leaving the global workspace shell.",
    body: input.body,
    currentWorkspaceSlug: input.workspaceSlug,
    breadcrumbs: input.projectKey
      ? [
          { label: "Home", href: "/" },
          { label: input.workspaceSlug },
          { label: input.projectKey }
        ]
      : [
          { label: "Home", href: "/" },
          { label: input.workspaceSlug }
        ]
  });

export const loadProjectShellPageData = async (input: {
  includeIssues?: boolean;
  projectKey: string;
  scope?: "all" | "assigned" | "created";
  surface: ProjectSurface;
  workspaceSlug: string;
}): Promise<ProjectShellLoadResult> => {
  const copy = projectSurfaceCopy[input.surface];
  let workspace;

  try {
    workspace = await getWorkspaceBySlug(input.workspaceSlug);
  } catch (error) {
    if (getRequestStatus(error) === 401 || getRequestStatus(error) === 403) {
      return {
        kind: "state",
        node: await renderProjectState({
          body: `Ask a workspace owner to invite you to ${input.workspaceSlug}, or return home and open another workspace.`,
          eyebrow: copy.deniedEyebrow,
          title: copy.workspaceTitle,
          workspaceSlug: input.workspaceSlug
        })
      };
    }

    throw error;
  }

  if (!workspace) {
    return {
      kind: "not_found"
    };
  }

  let project;

  try {
    project = await getProjectByKey(workspace.slug, input.projectKey);
  } catch (error) {
    if (getRequestStatus(error) === 401 || getRequestStatus(error) === 403) {
      return {
        kind: "state",
        node: await renderProjectState({
          body: "The workspace exists, but your account cannot see this project yet. Ask an owner to grant project access, then try again.",
          eyebrow: copy.deniedEyebrow,
          projectKey: input.projectKey,
          title: copy.deniedTitle(input.projectKey),
          workspaceSlug: input.workspaceSlug
        })
      };
    }

    throw error;
  }

  if (!project) {
    return {
      kind: "not_found"
    };
  }

  const [projects, issues] = await Promise.all([
    getProjectsForWorkspace(workspace.slug),
    input.includeIssues === false
      ? Promise.resolve([])
      : getIssueSummariesForProject(workspace.slug, project.key, input.scope ?? "all")
  ]);

  return {
    data: {
      issues,
      project,
      projects,
      workspace
    },
    kind: "ok"
  };
};
