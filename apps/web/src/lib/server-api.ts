import type {
  IntegrationInstallationDto,
  IntegrationProjectLinkDto,
  IssueDetailDto,
  IssueListItemDto,
  WorkspaceSearchQuery,
  WorkspaceSearchResponseDto,
  MeDto,
  ProjectBoardConfigDto,
  ProjectBoardViewDto,
  ProjectMemberDto,
  ProjectSummaryDto,
  SessionDto,
  SyncStatusDto,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
  WorkspaceDto,
  WorkspaceSummaryDto
} from "@wevlo/contracts";
import { redirect } from "next/navigation";

import { buildApiV1Url } from "@/lib/api-paths";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { buildApiInternalAuthHeaders } from "@/lib/internal-auth-headers";
import { getInternalAuthToken, getWebApiBaseUrl } from "@/lib/env";

const apiBaseUrl = getWebApiBaseUrl();
const internalToken = getInternalAuthToken();
const isProfileSetupRequired = (me: MeDto): boolean => me.user.name.trim().length === 0;

const requestJson = async <TResponse>(
  path: string,
  init?: RequestInit,
  options?: {
    allowNotFound?: boolean;
  }
): Promise<TResponse | null> => {
  const session = await requireCurrentAuthSession();

  const response = await fetch(buildApiV1Url(apiBaseUrl, path), {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...buildApiInternalAuthHeaders(
        {
          provider: session.provider,
          providerUserId: session.providerUserId,
          ...(session.userAvatarUrl !== undefined ? { userAvatarUrl: session.userAvatarUrl } : {}),
          userEmail: session.userEmail,
          userId: session.userId,
          userName: session.userName
        },
        internalToken
      ),
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

export const getMe = async (options?: {
  allowIncompleteProfile?: boolean;
}): Promise<MeDto> => {
  const me = await requestJson<MeDto>("/me");

  if (!me) {
    throw new Error("User profile unavailable");
  }

  if (!options?.allowIncompleteProfile && isProfileSetupRequired(me)) {
    redirect("/welcome/profile");
  }

  return me;
};

export const listWorkspaces = async (): Promise<WorkspaceSummaryDto[]> => {
  const workspaces = await requestJson<WorkspaceSummaryDto[]>("/workspaces");
  return workspaces ?? [];
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

export const getWorkspaceIntegrations = async (
  workspaceSlug: string
): Promise<IntegrationInstallationDto[]> => {
  const installations = await requestJson<IntegrationInstallationDto[]>(
    `/integrations/workspaces/${workspaceSlug}/installations`
  );

  return installations ?? [];
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
  }>(`/integrations/workspaces/${workspaceSlug}/projects/${projectKey}/links`);

  return response ?? {
    links: [],
    syncStatuses: []
  };
};

export const getIssueSummariesForProject = async (
  workspaceSlug: string,
  projectKey: string,
  scope: "all" | "assigned" | "created" = "all"
): Promise<IssueListItemDto[]> => {
  const issues = await requestJson<IssueListItemDto[]>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues/summary?scope=${scope}`
  );

  return issues ?? [];
};

export const getIssuesForProject = async (
  workspaceSlug: string,
  projectKey: string,
  scope: "all" | "assigned" | "created" = "all"
): Promise<IssueDetailDto[]> => {
  const issues = await requestJson<IssueDetailDto[]>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/issues?scope=${scope}`
  );
  return issues ?? [];
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

export const getProjectBoardView = async (
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

export const getBoardColumns = async (
  workspaceSlug: string,
  projectKey: string
): Promise<ProjectBoardViewDto> => {
  return getProjectBoardView(workspaceSlug, projectKey);
};

export const getTriageQueue = async (
  workspaceSlug: string,
  projectKey: string
): Promise<IssueDetailDto[]> => {
  const triageQueue = await requestJson<IssueDetailDto[]>(
    `/workspaces/${workspaceSlug}/projects/${projectKey}/triage`
  );
  const details = await Promise.all(
    (triageQueue ?? []).map(async (issue) => getIssueByKey(workspaceSlug, projectKey, issue.issueKey))
  );

  return details.filter((issue): issue is IssueDetailDto => Boolean(issue));
};

export const getWorkspaceMembers = async (workspaceSlug: string): Promise<WorkspaceMemberDto[]> => {
  const members = await requestJson<WorkspaceMemberDto[]>(`/workspaces/${workspaceSlug}/members`);
  return members ?? [];
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

export const getWorkspaceInvitations = async (workspaceSlug: string): Promise<WorkspaceInvitationDto[]> => {
  const invitations = await requestJson<WorkspaceInvitationDto[]>(`/workspaces/${workspaceSlug}/invitations`);
  return invitations ?? [];
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
