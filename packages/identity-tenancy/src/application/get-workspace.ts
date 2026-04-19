import type { Workspace } from "../domain/workspace";

export type WorkspaceLookupRepository = {
  findForUserBySlug: (userId: string, slug: string) => Promise<Workspace | null>;
};

export const getWorkspaceBySlugUseCase = async (
  repository: WorkspaceLookupRepository,
  userId: string,
  slug: string
): Promise<Workspace | null> => {
  return repository.findForUserBySlug(userId, slug);
};
