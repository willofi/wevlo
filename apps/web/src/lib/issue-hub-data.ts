import type {
  CreateCommentRequest,
  CreateIntegrationInstallationRequest,
  CreateIntegrationProjectLinkRequest,
  CreateIssueRequest,
  CreateIssueLabelRequest,
  CreateProjectRequest,
  CreateWorkspaceRequest,
  HandleAvailabilityDto,
  ImportIntegrationProjectIssuesRequest,
  IntegrationInstallationDto,
  IntegrationProjectLinkDto,
  IssueDetailDto,
  IssueAttachmentDto,
  IssueActivityItemDto,
  IssueLabelDto,
  IssueListItemDto,
  IssueSubscriptionStateDto,
  WorkspaceSearchQuery,
  WorkspaceSearchResponseDto,
  MeDto,
  MyIssuesQuery,
  MyIssuesResponseDto,
  NotificationIdsRequest,
  NotificationListQuery,
  NotificationListResponseDto,
  NotificationPreferenceDto,
  NotificationSummaryDto,
  ProjectBoardConfigDto,
  ProjectBoardViewDto,
  ProjectMemberDto,
  ProjectSummaryDto,
  SessionDto,
  SyncStatusDto,
  TransitionIssueRequest,
  UpdateIssueReactionRequest,
  UpdateProfileRequest,
  UpdateIssueSubscriptionRequest,
  UpdateIssueRequest,
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceInvitationResult,
  WorkspaceMemberDto,
  WorkspaceRole,
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
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>)
  };

  if (init?.body && !(init.body instanceof FormData) && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers
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

export const getHandleAvailability = async (handle: string): Promise<HandleAvailabilityDto> => {
  const searchParams = new URLSearchParams({
    handle
  });
  const response = await requestJson<HandleAvailabilityDto>(`/me/handle-availability?${searchParams.toString()}`);

  if (!response) {
    throw new Error("Handle availability unavailable");
  }

  return response;
};

export const updateProfile = async (payload: UpdateProfileRequest): Promise<MeDto["user"]> => {
  const user = await requestJson<MeDto["user"]>("/me/profile", {
    body: JSON.stringify(payload),
    method: "PATCH"
  });

  if (!user) {
    throw new Error("Profile update returned no payload");
  }

  return user;
};

export const uploadProfileAvatar = async (file: File): Promise<MeDto["user"]> => {
  const formData = new FormData();
  formData.set("file", file);

  const user = await requestJson<MeDto["user"]>("/me/profile/avatar", {
    body: formData,
    method: "POST"
  });

  if (!user) {
    throw new Error("Profile image upload returned no payload");
  }

  return user;
};

export const removeProfileAvatar = async (): Promise<MeDto["user"]> => {
  const user = await requestJson<MeDto["user"]>("/me/profile/avatar", {
    method: "DELETE"
  });

  if (!user) {
    throw new Error("Profile image removal returned no payload");
  }

  return user;
};

export const getNotificationSummary = async (): Promise<NotificationSummaryDto> => {
  const summary = await requestJson<NotificationSummaryDto>("/notifications/summary");

  if (!summary) {
    return {
      items: [],
      unseenCount: 0
    };
  }

  return summary;
};

export const getNotifications = async (query: Partial<NotificationListQuery> = {}): Promise<NotificationListResponseDto> => {
  const searchParams = new URLSearchParams();

  if (query.category) {
    searchParams.set("category", query.category);
  }

  if (query.projectId) {
    searchParams.set("projectId", query.projectId);
  }

  if (query.status) {
    searchParams.set("status", query.status);
  }

  if (query.workspaceId) {
    searchParams.set("workspaceId", query.workspaceId);
  }

  const path = `/notifications${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await requestJson<NotificationListResponseDto>(path);

  return response ?? {
    items: [],
    unreadCount: 0,
    unseenCount: 0
  };
};

const postNotificationIds = async (path: string, payload: NotificationIdsRequest): Promise<void> => {
  await requestJson(path, {
    body: JSON.stringify(payload),
    method: "POST"
  });
};

export const markNotificationsSeen = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  await postNotificationIds("/notifications/seen", { ids });
};

export const markNotificationsRead = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  await postNotificationIds("/notifications/read", { ids });
};

export const archiveNotifications = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  await postNotificationIds("/notifications/archive", { ids });
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await requestJson("/notifications/read-all", {
    method: "POST"
  });
};

export const getNotificationPreferences = async (): Promise<NotificationPreferenceDto> => {
  const preferences = await requestJson<NotificationPreferenceDto>("/notification-preferences");

  if (!preferences) {
    throw new Error("Notification preferences unavailable");
  }

  return preferences;
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

export const searchWorkspace = async (
  workspaceSlug: string,
  query: Partial<WorkspaceSearchQuery>
): Promise<WorkspaceSearchResponseDto> => {
  const searchParams = new URLSearchParams();

  if (query.q !== undefined) {
    searchParams.set("q", query.q);
  }

  if (query.scope) {
    searchParams.set("scope", query.scope);
  }

  const response = await requestJson<WorkspaceSearchResponseDto>(
    `/workspaces/${workspaceSlug}/search?${searchParams.toString()}`
  );

  return response ?? {
    documents: [],
    issues: [],
    projects: []
  };
};

export const getMyIssues = async (
  query: {
    projectKey?: string;
    tab?: MyIssuesQuery["tab"];
    workspaceSlug?: string;
  } = {}
): Promise<MyIssuesResponseDto> => {
  const searchParams = new URLSearchParams();

  if (query.projectKey) {
    searchParams.set("projectKey", query.projectKey);
  }

  if (query.tab) {
    searchParams.set("tab", query.tab);
  }

  if (query.workspaceSlug) {
    searchParams.set("workspaceSlug", query.workspaceSlug);
  }

  const path = `/me/issues${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await requestJson<MyIssuesResponseDto>(path);

  return response ?? {
    items: []
  };
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

export const listProjectLabels = async (
  workspaceSlug: string,
  projectKey: string
): Promise<IssueLabelDto[]> => {
  const labels = await requestJson<IssueLabelDto[]>(`/workspaces/${workspaceSlug}/projects/${projectKey}/labels`);
  return labels ?? [];
};

export const createProjectLabel = async (
  workspaceSlug: string,
  projectKey: string,
  payload: CreateIssueLabelRequest
): Promise<IssueLabelDto> => {
  const label = await requestJson<IssueLabelDto>(`/workspaces/${workspaceSlug}/projects/${projectKey}/labels`, {
    body: JSON.stringify(payload),
    method: "POST"
  });

  if (!label) {
    throw new Error("Label creation returned no payload");
  }

  return label;
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

export const getIssueActivity = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string
): Promise<IssueActivityItemDto[]> => {
  const items = await requestJson<IssueActivityItemDto[]>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/activity`
  );

  return items ?? [];
};

export const getIssueSubscription = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string
): Promise<IssueSubscriptionStateDto> => {
  const subscription = await requestJson<IssueSubscriptionStateDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/subscription`
  );

  if (!subscription) {
    throw new Error("Issue subscription unavailable");
  }

  return subscription;
};

export const updateIssue = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  payload: UpdateIssueRequest,
  options?: {
    keepalive?: boolean;
  }
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}`,
    {
      body: JSON.stringify(payload),
      ...(options?.keepalive ? { keepalive: true } : {}),
      method: "PATCH"
    }
  );

  if (!issue) {
    throw new Error("Issue update returned no payload");
  }

  return issue;
};

export const getIssueAttachmentHref = (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  attachmentId: string
): string =>
  `/api/bff/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/attachments/${attachmentId}`;

export const uploadIssueAttachment = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  file: File
): Promise<IssueAttachmentDto> => {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(
    `${apiBaseUrl}/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/attachments`,
    {
      body: formData,
      cache: "no-store",
      method: "POST"
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Attachment upload failed: ${response.status} ${message}`);
  }

  return (await response.json()) as IssueAttachmentDto;
};

export const deleteIssueAttachment = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  attachmentId: string
): Promise<void> => {
  await requestJson(`/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/attachments/${attachmentId}`, {
    method: "DELETE"
  });
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

export const setIssueSubscription = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  payload: UpdateIssueSubscriptionRequest
): Promise<IssueSubscriptionStateDto> => {
  const subscription = await requestJson<IssueSubscriptionStateDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/subscription`,
    {
      body: JSON.stringify(payload),
      method: "PUT"
    }
  );

  if (!subscription) {
    throw new Error("Issue subscription update returned no payload");
  }

  return subscription;
};

export const setIssueReaction = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  payload: UpdateIssueReactionRequest
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/reactions`,
    {
      body: JSON.stringify(payload),
      method: "PUT"
    }
  );

  if (!issue) {
    throw new Error("Issue reaction update returned no payload");
  }

  return issue;
};

export const setCommentReaction = async (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  commentId: string,
  payload: UpdateIssueReactionRequest
): Promise<IssueDetailDto> => {
  const issue = await requestJson<IssueDetailDto>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/${issueKey}/comments/${commentId}/reactions`,
    {
      body: JSON.stringify(payload),
      method: "PUT"
    }
  );

  if (!issue) {
    throw new Error("Comment reaction returned no payload");
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
    emails?: string[];
    role: WorkspaceRole;
    userId?: string;
  }
): Promise<WorkspaceInvitationResult[]> => {
  const response = await requestJson<{ results: WorkspaceInvitationResult[] }>(`/workspaces/${workspaceSlug}/invitations`, {
    body: JSON.stringify(payload),
    method: "POST"
  });

  if (!response) {
    throw new Error("Invitation creation returned no payload");
  }

  return response.results;
};

export const updateWorkspaceMember = async (
  workspaceSlug: string,
  userId: string,
  payload: {
    role: WorkspaceRole;
  }
): Promise<WorkspaceMemberDto> => {
  const member = await requestJson<WorkspaceMemberDto>(`/workspaces/${workspaceSlug}/members/${encodeURIComponent(userId)}`, {
    body: JSON.stringify(payload),
    method: "PUT"
  });

  if (!member) {
    throw new Error("Workspace member update returned no payload");
  }

  return member;
};

export const removeWorkspaceMember = async (
  workspaceSlug: string,
  userId: string
): Promise<void> => {
  await requestJson(`/workspaces/${workspaceSlug}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
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

export const getIssueCommentHref = (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  commentId: string
): string =>
  `${getIssueHref(workspaceSlug, projectKey, issueKey)}?comment=${encodeURIComponent(commentId)}#comment-${encodeURIComponent(commentId)}`;

export const getIssueDescriptionHref = (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  options: {
    endOffset: number;
    startOffset: number;
  }
): string =>
  `${getIssueHref(workspaceSlug, projectKey, issueKey)}?target=description&start=${options.startOffset}&end=${options.endOffset}#description`;

export const getIssuePanelHref = (workspaceSlug: string, projectKey: string, issueKey: string): string =>
  buildProjectShellHref(workspaceSlug, projectKey, { issueKey });

export const getMyIssuesHref = (options?: {
  projectKey?: string;
  workspaceSlug?: string;
}): string => {
  const searchParams = new URLSearchParams();

  if (options?.projectKey) {
    searchParams.set("projectKey", options.projectKey);
  }

  if (options?.workspaceSlug) {
    searchParams.set("workspace", options.workspaceSlug);
  }

  const query = searchParams.toString();
  return query.length > 0 ? `/my-issues?${query}` : "/my-issues";
};

export const getInboxHref = (options?: {
  projectId?: string;
  workspaceId?: string;
}): string => {
  const searchParams = new URLSearchParams();

  if (options?.projectId) {
    searchParams.set("project", options.projectId);
  }

  if (options?.workspaceId) {
    searchParams.set("workspace", options.workspaceId);
  }

  const query = searchParams.toString();
  return query.length > 0 ? `/notifications?${query}` : "/notifications";
};

export const getWorkspaceHref = (workspaceSlug: string): string => `/${workspaceSlug}`;

export const getWorkspaceMembersHref = (workspaceSlug: string): string => `/${workspaceSlug}/settings/members`;

export const getWorkspaceMemberHref = (workspaceSlug: string, userId: string): string =>
  `/${workspaceSlug}/members/${encodeURIComponent(userId)}`;

export const getWorkspaceAccessHref = (workspaceSlug: string): string => `/${workspaceSlug}/settings/access`;

export const getWorkspaceIntegrationsHref = (workspaceSlug: string): string => `/${workspaceSlug}/integrations`;

export const getProjectAccessHref = (workspaceSlug: string, projectKey: string): string =>
  `/${workspaceSlug}/${projectKey}/access`;

export const getProjectIntegrationsHref = (workspaceSlug: string, projectKey: string): string =>
  `/${workspaceSlug}/${projectKey}/integrations`;

export const getLoginHref = (nextPath?: string | null): string => buildLoginHref(nextPath);

export const getInviteHref = (inviteCode: string): string => `/invite/${encodeURIComponent(inviteCode)}`;
