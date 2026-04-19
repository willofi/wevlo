import { buildWorkspaceSlugCandidates, normalizeWorkspaceSlug } from "@wevlo/core";

import { createWorkspace, type Workspace } from "../domain/workspace";
import { createWorkspaceMembership, type WorkspaceMembership } from "../domain/workspace-membership";

export type WorkspaceRepository = {
  findBySlug: (slug: string) => Promise<Workspace | null>;
  saveMembership: (membership: WorkspaceMembership) => Promise<void>;
  save: (workspace: Workspace) => Promise<void>;
};

export class WorkspaceSlugTakenError extends Error {
  constructor(slug: string) {
    super(`Workspace slug already exists: ${slug}`);
  }
}

export class WorkspaceSlugGenerationFailedError extends Error {
  constructor(name: string) {
    super(`Unable to generate an available workspace slug for: ${name}`);
  }
}

export const createWorkspaceUseCase = async (
  repository: WorkspaceRepository,
  input: { name: string; ownerUserId: string; slug?: string | undefined }
): Promise<Workspace> => {
  const requestedSlug = input.slug?.trim();

  if (requestedSlug) {
    const normalizedSlug = normalizeWorkspaceSlug(requestedSlug);
    const existing = await repository.findBySlug(normalizedSlug);

    if (existing) {
      throw new WorkspaceSlugTakenError(normalizedSlug);
    }

    const workspace = createWorkspace(input.name, normalizedSlug);
    const membership = createWorkspaceMembership(workspace.id, input.ownerUserId, "Owner");
    await repository.save(workspace);
    await repository.saveMembership(membership);
    return workspace;
  }

  const candidates = buildWorkspaceSlugCandidates(input.name);

  for (const candidate of candidates) {
    const existing = await repository.findBySlug(candidate);

    if (existing) {
      continue;
    }

    const workspace = createWorkspace(input.name, candidate);
    const membership = createWorkspaceMembership(workspace.id, input.ownerUserId, "Owner");
    await repository.save(workspace);
    await repository.saveMembership(membership);
    return workspace;
  }

  throw new WorkspaceSlugGenerationFailedError(input.name);
};
