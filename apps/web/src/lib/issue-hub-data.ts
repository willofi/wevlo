import type {
  CreateCommentRequest,
  CreateIntegrationInstallationRequest,
  CreateIntegrationProjectLinkRequest,
  CreateIssueRequest,
  CreateProjectRequest,
  CreateWorkspaceRequest,
  ImportIntegrationProjectIssuesRequest,
  IntegrationInstallationDto,
  IntegrationProjectLinkDto,
  IssueDetailDto,
  IssueListItemDto,
  MeDto,
  ProjectBoardConfigDto,
  ProjectBoardViewDto,
  ProjectMemberDto,
  ProjectSummaryDto,
  SessionDto,
  SyncStatusDto,
  TransitionIssueRequest,
  UpdateIssueRequest,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
  WorkspaceDto,
  WorkspaceSummaryDto
} from "@wevlo/contracts";
import {
  buildLoginHref,
  demoUsers,
  type DemoUser
} from "@wevlo/auth";

const apiBaseUrl = "/api/bff";
const resourceReadAttempts = 5;
const resourceReadDelayMs = 120;

const sleep = async (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const requestJson = async <TResponse>(
  path: string,
  init?: RequestInit,
  options?: {
    allowNotFound?: boolean;
  }
): Promise<TResponse | null> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 404 && options?.allowNotFound) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Request failed: ${response.status} ${message}`);
  }

  return (await response.json()) as TResponse;
};

export const getSession = async (): Promise<SessionDto> => {
  const session = await requestJson<SessionDto>("/session");

  if (!session) {
    throw new Error("Session unavailable");
  }

  return session;
};

export const getMe = async (): Promise<MeDto> => {
  const me = await requestJson<MeDto>("/me");

  if (!me) {
    throw new Error("Profile unavailable");
  }

  return me;
};

export const listWorkspaces = async (): Promise<WorkspaceSummaryDto[]> => {
  const workspaces = await requestJson<WorkspaceSummaryDto[]>("/workspaces");
  return workspaces ?? [];
};

export const createWorkspace = async (payload: CreateWorkspaceRequest): Promise<WorkspaceDto> => {
  const workspace = await requestJson<WorkspaceDto>("/workspaces", {
    body: JSON.stringify(payload),
    method: "POST"
  });

  if (!workspace) {
    throw new Error("Workspace creation returned no payload");
  }

  return workspace;
};

export const getWorkspaceBySlug = async (slug: string): Promise<WorkspaceDto | undefined> => {
  const workspace = await requestJson<WorkspaceDto>(`/workspaces/${slug}`, undefined, {
    allowNotFound: true
  });

  return workspace ?? undefined;
};

export const getProjectsForWorkspace = async (workspaceSlug: string): Promise<ProjectSummaryDto[]> => {
  const projects = await requestJson<ProjectSummaryDto[]>(`/workspaces/${workspaceSlug}/projects`);
  return projects ?? [];
};

export const createProject = async (
  workspaceSlug: string,
  payload: CreateProjectRequest
): Promise<ProjectSummaryDto> => {
  const project = await requestJson<ProjectSummaryDto>(`/workspaces/${workspaceSlug}/projects`, {
    body: JSON.stringify(payload),
    method: "POST"
  });

  if (!project) {
    throw new Error("Project creation returned no payload");
  }

  return project;
};

export const getProjectByKey = async (
  workspaceSlug: string,
  projectKey: string
): Promise<ProjectSummaryDto | undefined> => {
  const project = await requestJson<ProjectSummaryDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}`,
    undefined,
    {
      allowNotFound: true
    }
  );

  return project ?? undefined;
};

export const waitForWorkspaceRead = async (workspaceSlug: string): Promise<WorkspaceDto> => {
  for (let attempt = 0; attempt < resourceReadAttempts; attempt += 1) {
    const workspace = await getWorkspaceBySlug(workspaceSlug);

    if (workspace) {
      return workspace;
    }

    await sleep(resourceReadDelayMs * (attempt + 1));
  }

  throw new Error(`Workspace ${workspaceSlug} was created, but it is not readable yet.`);
};

export const waitForProjectRead = async (
  workspaceSlug: string,
  projectKey: string
): Promise<ProjectSummaryDto> => {
  const normalizedProjectKey = projectKey.toUpperCase();

  for (let attempt = 0; attempt < resourceReadAttempts; attempt += 1) {
    const project = await getProjectByKey(workspaceSlug, normalizedProjectKey);

    if (project) {
      return project;
    }

    await sleep(resourceReadDelayMs * (attempt + 1));
  }

  throw new Error(`Project ${normalizedProjectKey} was created, but it is not readable yet.`);
};

const listProjectIssueSummaries = async (
  workspaceSlug: string,
  projectKey: string,
  scope: "all" | "assigned" | "created" = "all"
): Promise<IssueListItemDto[]> => {
  const issues = await requestJson<IssueListItemDto[]>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues?scope=${scope}`
  );

  return issues ?? [];
};

export const getIssuesForProject = async (
  workspaceSlug: string,
  projectKey: string,
  scope: "all" | "assigned" | "created" = "all"
): Promise<IssueDetailDto[]> => {
  const issues = await listProjectIssueSummaries(workspaceSlug, projectKey, scope);
  const details = await Promise.all(
    issues.map(async (issue) => getIssueByKey(workspaceSlug, projectKey, issue.issueKey))
  );

  return details.filter((issue): issue is IssueDetailDto => Boolean(issue));
};

export const createIssue = async (
  workspaceSlug: string,
  projectKey: string,
  payload: CreateIssueRequest
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(`/workspaces/${workspaceSlug}/projects/${projectKey}/issues`, {
    body: JSON.stringify(payload),
    method: "POST"
  });

  if (!issue) {
    throw new Error("Issue creation returned no payload");
  }

  return issue;
};

export const getWorkspaceIntegrations = async (
  workspaceSlug: string
): Promise<IntegrationInstallationDto[]> => {
  const installations = await requestJson<IntegrationInstallationDto[]>(
    `/workspaces/${workspaceSlug}/integrations/installations`
  );

  return installations ?? [];
};

export const createWorkspaceIntegrationInstallation = async (
  workspaceSlug: string,
  provider: "github" | "gitlab",
  payload: CreateIntegrationInstallationRequest
): Promise<IntegrationInstallationDto> => {
  const installation = await requestJson<IntegrationInstallationDto>(
    `/workspaces/${workspaceSlug}/integrations/${provider}/installations`,
    {
      body: JSON.stringify(payload),
      method: "POST"
    }
  );

  if (!installation) {
    throw new Error("Integration installation creation returned no payload");
  }

  return installation;
};

export const getProjectIntegrations = async (
  workspaceSlug: string,
  projectKey: string
): Promise<{
  links: IntegrationProjectLinkDto[];
  syncStatuses: SyncStatusDto[];
}> => {
  const response = await requestJson<{
    links: IntegrationProjectLinkDto[];
    syncStatuses: SyncStatusDto[];
  }>(`/workspaces/${workspaceSlug}/projects/${projectKey}/integrations/links`);

  return response ?? {
    links: [],
    syncStatuses: []
  };
};

export const createProjectIntegrationLink = async (
  workspaceSlug: string,
  projectKey: string,
  provider: "github" | "gitlab",
  payload: CreateIntegrationProjectLinkRequest
): Promise<IntegrationProjectLinkDto> => {
  const link = await requestJson<IntegrationProjectLinkDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/integrations/${provider}/links`,
    {
      body: JSON.stringify(payload),
      method: "POST"
    }
  );

  if (!link) {
    throw new Error("Integration project link creation returned no payload");
  }

  return link;
};

export const importProjectIntegrationIssues = async (
  workspaceSlug: string,
  projectKey: string,
  provider: "github" | "gitlab",
  payload: ImportIntegrationProjectIssuesRequest
): Promise<{
  importedCount: number;
  projectLink: IntegrationProjectLinkDto;
}> => {
  const response = await requestJson<{
    importedCount: number;
    projectLink: IntegrationProjectLinkDto;
  }>(`/workspaces/${workspaceSlug}/projects/${projectKey}/integrations/${provider}/import`, {
    body: JSON.stringify(payload),
    method: "POST"
  });

  if (!response) {
    throw new Error("Integration issue import returned no payload");
  }

  return response;
};

export const getIssueByKey = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string
): Promise<IssueDetailDto | undefined> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}`,
    undefined,
    {
      allowNotFound: true
    }
  );

  return issue ?? undefined;
};

export const updateIssue = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  payload: UpdateIssueRequest
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}`,
    {
      body: JSON.stringify(payload),
      method: "PATCH"
    }
  );

  if (!issue) {
    throw new Error("Issue update returned no payload");
  }

  return issue;
};

export const transitionIssue = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  payload: TransitionIssueRequest
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/transition`,
    {
      body: JSON.stringify(payload),
      method: "POST"
    }
  );

  if (!issue) {
    throw new Error("Issue transition returned no payload");
  }

  return issue;
};

export const createComment = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  payload: CreateCommentRequest
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/comments`,
    {
      body: JSON.stringify(payload),
      method: "POST"
    }
  );

  if (!issue) {
    throw new Error("Comment creation returned no payload");
  }

  return issue;
};

export const getBoardColumns = async (
  workspaceSlug: string,
  projectKey: string
): Promise<ProjectBoardViewDto> => {
  const board = await requestJson<ProjectBoardViewDto>(`/workspaces/${workspaceSlug}/projects/${projectKey}/board`);

  if (!board) {
    throw new Error("Project board unavailable");
  }

  return board;
};

export const getProjectBoardConfig = async (
  workspaceSlug: string,
  projectKey: string
): Promise<ProjectBoardConfigDto> => {
  const config = await requestJson<ProjectBoardConfigDto>(`/workspaces/${workspaceSlug}/projects/${projectKey}/board-config`);

  if (!config) {
    throw new Error("Project board config unavailable");
  }

  return config;
};

export const updateProjectBoardConfig = async (
  workspaceSlug: string,
  projectKey: string,
  payload: Pick<ProjectBoardConfigDto, "columns">
): Promise<ProjectBoardConfigDto> => {
  const config = await requestJson<ProjectBoardConfigDto>(`/workspaces/${workspaceSlug}/projects/${projectKey}/board-config`, {
    body: JSON.stringify(payload),
    method: "PATCH"
  });

  if (!config) {
    throw new Error("Project board config update returned no payload");
  }

  return config;
};

export const getTriageQueue = async (
  workspaceSlug: string,
  projectKey: string
): Promise<IssueDetailDto[]> => {
  const triageQueue = await requestJson<IssueListItemDto[]>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/triage`
  );
  const details = await Promise.all(
    (triageQueue ?? []).map(async (issue) => getIssueByKey(workspaceSlug, projectKey, issue.issueKey))
  );

  return details.filter((issue): issue is IssueDetailDto => Boolean(issue));
};

export const triageIssue = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  payload: Pick<UpdateIssueRequest, "assigneeUserId" | "priority">
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/triage`,
    {
      body: JSON.stringify(payload),
      method: "POST"
    }
  );

  if (!issue) {
    throw new Error("Issue triage returned no payload");
  }

  return issue;
};

export const acceptTriage = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/triage/accept`,
    {
      method: "POST"
    }
  );

  if (!issue) {
    throw new Error("Issue triage acceptance returned no payload");
  }

  return issue;
};

export const getWorkspaceMembers = async (workspaceSlug: string): Promise<WorkspaceMemberDto[]> => {
  const members = await requestJson<WorkspaceMemberDto[]>(`/workspaces/${workspaceSlug}/members`);
  return members ?? [];
};

export const getWorkspaceInvitations = async (workspaceSlug: string): Promise<WorkspaceInvitationDto[]> => {
  const invitations = await requestJson<WorkspaceInvitationDto[]>(`/workspaces/${workspaceSlug}/invitations`);
  return invitations ?? [];
};

export const createWorkspaceInvitation = async (
  workspaceSlug: string,
  payload: {
    email?: string;
    role: "Owner" | "Member";
    userId?: string;
  }
): Promise<WorkspaceInvitationDto> => {
  const invitation = await requestJson<WorkspaceInvitationDto>(`/workspaces/${workspaceSlug}/invitations`, {
    body: JSON.stringify(payload),
    method: "POST"
  });

  if (!invitation) {
    throw new Error("Invitation creation returned no payload");
  }

  return invitation;
};

export const getWorkspaceInvitationByToken = async (
  inviteToken: string
): Promise<WorkspaceInvitationDto | undefined> => {
  const invitation = await requestJson<WorkspaceInvitationDto>(
    `/workspace-invitations/${encodeURIComponent(inviteToken)}`,
    undefined,
    {
      allowNotFound: true
    }
  );

  return invitation ?? undefined;
};

export const acceptWorkspaceInvitation = async (
  workspaceSlug: string,
  invitationId: string
): Promise<WorkspaceInvitationDto> => {
  const invitation = await requestJson<WorkspaceInvitationDto>(
    `/workspaces/${workspaceSlug}/invitations/${invitationId}/accept`,
    {
      method: "POST"
    }
  );

  if (!invitation) {
    throw new Error("Invitation acceptance returned no payload");
  }

  return invitation;
};

export const acceptWorkspaceInvitationByToken = async (
  inviteToken: string
): Promise<WorkspaceInvitationDto> => {
  const invitation = await requestJson<WorkspaceInvitationDto>(
    `/workspace-invitations/${encodeURIComponent(inviteToken)}/accept`,
    {
      method: "POST"
    }
  );

  if (!invitation) {
    throw new Error("Invitation acceptance returned no payload");
  }

  return invitation;
};

export const getProjectMembers = async (
  workspaceSlug: string,
  projectKey: string
): Promise<ProjectMemberDto[]> => {
  const members = await requestJson<ProjectMemberDto[]>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/members`
  );
  return members ?? [];
};

export const upsertProjectMember = async (
  workspaceSlug: string,
  projectKey: string,
  userId: string,
  payload: {
    role: ProjectMemberDto["role"];
  }
): Promise<ProjectMemberDto> => {
  const member = await requestJson<ProjectMemberDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/members/${encodeURIComponent(userId)}`,
    {
      body: JSON.stringify(payload),
      method: "PUT"
    }
  );

  if (!member) {
    throw new Error("Project member update returned no payload");
  }

  return member;
};

export const removeProjectMember = async (
  workspaceSlug: string,
  projectKey: string,
  userId: string
): Promise<void> => {
  await requestJson(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE"
    }
  );
};

const findDemoUser = (userId: string): DemoUser | undefined => demoUsers.find((user) => user.id === userId);

export const getUserLabel = (userId: string | null | undefined): string => {
  if (!userId) {
    return "Unassigned";
  }

  return findDemoUser(userId)?.name ?? userId;
};

export const getUserRole = (userId: string | null | undefined): string => {
  if (!userId) {
    return "Unassigned";
  }

  return findDemoUser(userId)?.role ?? "Member";
};

export const buildProjectShellHref = (
  workspaceSlug: string,
  projectKey: string,
  options?: {
    compose?: boolean;
    issueKey?: string;
    view?: "list" | "board";
  }
): string => {
  const searchParams = new URLSearchParams();

  if (options?.view) {
    searchParams.set("view", options.view);
  }

  if (options?.issueKey) {
    searchParams.set("issue", options.issueKey);
  }

  if (options?.compose) {
    searchParams.set("compose", "1");
  }

  const query = searchParams.toString();
  return query.length > 0 ? `/${workspaceSlug}/${projectKey}?${query}` : `/${workspaceSlug}/${projectKey}`;
};

export const getProjectHref = (workspaceSlug: string, projectKey: string, page?: string): string => {
  if (page === "board") {
    return buildProjectShellHref(workspaceSlug, projectKey, { view: "board" });
  }

  if (page === "new") {
    return buildProjectShellHref(workspaceSlug, projectKey, { compose: true });
  }

  return buildProjectShellHref(workspaceSlug, projectKey, page === "issues" ? { view: "list" } : undefined);
};

export const getIssueHref = (workspaceSlug: string, projectKey: string, issueKey: string): string =>
  `/${workspaceSlug}/${projectKey}/issues/${issueKey}`;

export const getIssuePanelHref = (workspaceSlug: string, projectKey: string, issueKey: string): string =>
  buildProjectShellHref(workspaceSlug, projectKey, { issueKey });

export const getWorkspaceHref = (workspaceSlug: string): string => `/${workspaceSlug}`;

export const getWorkspaceMembersHref = (workspaceSlug: string): string => `/${workspaceSlug}/members`;

export const getWorkspaceAccessHref = (workspaceSlug: string): string => `/${workspaceSlug}/access`;

export const getWorkspaceIntegrationsHref = (workspaceSlug: string): string => `/${workspaceSlug}/integrations`;

export const getProjectAccessHref = (workspaceSlug: string, projectKey: string): string =>
  `/${workspaceSlug}/${projectKey}/access`;

export const getProjectIntegrationsHref = (workspaceSlug: string, projectKey: string): string =>
  `/${workspaceSlug}/${projectKey}/integrations`;

export const getLoginHref = (nextPath?: string | null): string => buildLoginHref(nextPath);

export const getInviteHref = (inviteCode: string): string => `/invite/${encodeURIComponent(inviteCode)}`;
