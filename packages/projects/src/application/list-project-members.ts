import type { ProjectMemberDto } from "@wevlo/contracts";

export type ProjectMemberRepository = {
  listMembers: (projectId: string) => Promise<ProjectMemberDto[]>;
};

export const listProjectMembersUseCase = async (
  repository: ProjectMemberRepository,
  projectId: string
): Promise<ProjectMemberDto[]> => {
  return repository.listMembers(projectId);
};
