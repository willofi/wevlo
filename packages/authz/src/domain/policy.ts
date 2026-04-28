import type { ProjectRole, WorkspaceRole } from "@wevlo/contracts";

export type WorkspaceAction = "workspace.view" | "workspace.invite" | "workspace.manage";
export type ProjectAction =
  | "project.manage"
  | "project.view"
  | "issue.create"
  | "issue.edit"
  | "issue.transition"
  | "issue.prioritize"
  | "integration.manage"
  | "project.delete";

export type AuthorizationAction = WorkspaceAction | ProjectAction;

const workspaceGrants: Record<WorkspaceRole, WorkspaceAction[]> = {
  Owner: ["workspace.view", "workspace.invite", "workspace.manage"],
  Maintainer: ["workspace.view", "workspace.invite", "workspace.manage"],
  Developer: ["workspace.view"],
  Member: ["workspace.view"],
  Guest: ["workspace.view"]
};

const projectGrants: Record<ProjectRole, ProjectAction[]> = {
  Owner: [
    "project.manage",
    "project.view",
    "issue.create",
    "issue.edit",
    "issue.transition",
    "issue.prioritize",
    "integration.manage",
    "project.delete"
  ],
  Maintainer: [
    "project.manage",
    "project.view",
    "issue.create",
    "issue.edit",
    "issue.transition",
    "issue.prioritize",
    "integration.manage"
  ],
  Developer: ["project.view", "issue.create", "issue.edit", "issue.transition"],
  Planner: ["project.view", "issue.create", "issue.edit", "issue.transition", "issue.prioritize"],
  Guest: ["project.view", "issue.create"]
};

export const canWorkspace = (role: WorkspaceRole, action: WorkspaceAction): boolean => {
  return workspaceGrants[role].includes(action);
};

export const can = (role: ProjectRole, action: ProjectAction): boolean => {
  return projectGrants[role].includes(action);
};
