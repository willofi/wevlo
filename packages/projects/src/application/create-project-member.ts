import type { ProjectMemberDto, ProjectRole } from "@wevlo/contracts";

export type CreateProjectMemberRepository = {
  createMember: (input: {
    projectId: string;
    role: ProjectRole;
    userId: string;
  }) => Promise<ProjectMemberDto>;
};

export const createProjectMemberUseCase = async (
  repository: CreateProjectMemberRepository,
  input: {
    projectId: string;
    role: ProjectRole;
    userId: string;
  }
): Promise<ProjectMemberDto> => {
  return repository.createMember(input);
};
