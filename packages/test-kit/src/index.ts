import type { ProjectDto, WorkspaceDto } from "@wevlo/contracts";

export const makeWorkspace = (overrides: Partial<WorkspaceDto> = {}): WorkspaceDto => ({
  id: "workspace_test",
  name: "Test Workspace",
  slug: "test-workspace",
  createdAt: "2026-04-04T00:00:00.000Z",
  ...overrides
});

export const makeProject = (overrides: Partial<ProjectDto> = {}): ProjectDto => ({
  id: "project_test",
  workspaceId: "workspace_test",
  name: "Test Project",
  key: "TEST",
  visibility: "private",
  memberships: [],
  ...overrides
});
