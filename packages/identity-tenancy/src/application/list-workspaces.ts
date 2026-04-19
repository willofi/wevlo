import type { Workspace } from "../domain/workspace";

export type VisibleWorkspaceRepository = {
  listForUser: (userId: string) => Promise<Workspace[]>;
};

export const listVisibleWorkspacesUseCase = async (
  repository: VisibleWorkspaceRepository,
  userId: string
): Promise<Workspace[]> => {
  return repository.listForUser(userId);
};
