import { buildProjectKeyCandidates, normalizeProjectKey, type WorkspaceId } from "@wevlo/core";

import { createProject, type Project } from "../domain/project";

export type ProjectRepository = {
  findByKey: (workspaceId: string, projectKey: string) => Promise<Project | null>;
  isWorkspaceMember: (workspaceId: string, userId: string) => Promise<boolean>;
  save: (project: Project) => Promise<void>;
};

export class ProjectAlreadyExistsError extends Error {
  constructor(projectKey: string) {
    super(`Project key already exists: ${projectKey}`);
  }
}

export class ProjectKeyGenerationFailedError extends Error {
  constructor(name: string) {
    super(`Unable to generate an available project key for: ${name}`);
  }
}

export class WorkspaceMembershipRequiredError extends Error {
  constructor(workspaceId: string) {
    super(`Workspace membership required: ${workspaceId}`);
  }
}

export const createProjectUseCase = async (
  repository: ProjectRepository,
  input: {
    key?: string | undefined;
    name: string;
    ownerUserId: string;
    workspaceId: string;
  }
): Promise<Project> => {
  const isWorkspaceMember = await repository.isWorkspaceMember(input.workspaceId, input.ownerUserId);

  if (!isWorkspaceMember) {
    throw new WorkspaceMembershipRequiredError(input.workspaceId);
  }

  const requestedKey = input.key?.trim();

  if (requestedKey) {
    const normalizedKey = normalizeProjectKey(requestedKey);
    const existing = await repository.findByKey(input.workspaceId, normalizedKey);

    if (existing) {
      throw new ProjectAlreadyExistsError(normalizedKey);
    }

    const project = createProject({
      ...input,
      workspaceId: input.workspaceId as WorkspaceId,
      key: normalizedKey
    });
    await repository.save(project);
    return project;
  }

  const candidates = buildProjectKeyCandidates(input.name);

  for (const candidate of candidates) {
    const existing = await repository.findByKey(input.workspaceId, candidate);

    if (existing) {
      continue;
    }

    const project = createProject({
      ...input,
      workspaceId: input.workspaceId as WorkspaceId,
      key: candidate
    });
    await repository.save(project);
    return project;
  }

  throw new ProjectKeyGenerationFailedError(input.name);
};
