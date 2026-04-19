import {
  createWorkspaceId,
  normalizeWorkspaceSlug,
  type WorkspaceId,
  type WorkspaceSlug
} from "@wevlo/core";

export type Workspace = {
  id: WorkspaceId;
  name: string;
  slug: WorkspaceSlug;
  createdAt: string;
};

export const createWorkspace = (name: string, slug: string): Workspace => ({
  id: createWorkspaceId(),
  name,
  slug: normalizeWorkspaceSlug(slug),
  createdAt: new Date().toISOString()
});
