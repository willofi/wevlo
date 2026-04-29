"use client";

import {
  useQuery
} from "@tanstack/react-query";

import type {
  IssueDetailDto,
  IssueLabelDto,
  IssueListItemDto,
  NotificationListQuery,
  NotificationSummaryDto,
  ProjectSummaryDto,
  WorkspaceMemberDto
} from "@wevlo/contracts";

import {
  getIssueByKey,
  getNotificationSummary,
  getNotifications,
  getProjectsForWorkspace,
  getWorkspaceMembers,
  listProjectIssueSummaries,
  listProjectLabels
} from "@/lib/issue-hub-data";
import { queryKeys } from "@/lib/query-keys";

type QueryHookOptions<TValue> = {
  enabled?: boolean;
  initialData?: TValue;
};

export const issueSummaryScopes = ["all", "assigned", "created"] as const;

export const toIssueSummary = (issue: IssueDetailDto): IssueListItemDto => ({
  assigneeUserId: issue.assigneeUserId,
  createdAt: issue.createdAt,
  dueDate: issue.dueDate,
  id: issue.id,
  issueKey: issue.issueKey,
  issueNumber: issue.issueNumber,
  labels: issue.labels,
  parentIssueId: issue.parentIssueId,
  priority: issue.priority,
  projectId: issue.projectId,
  reporterUserId: issue.reporterUserId,
  sourceLinks: issue.sourceLinks,
  state: issue.state,
  title: issue.title,
  triageStatus: issue.triageStatus,
  updatedAt: issue.updatedAt
});

export const sortIssueSummaries = (issues: IssueListItemDto[]): IssueListItemDto[] =>
  [...issues].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

export const useNotificationSummaryQuery = (
  options?: QueryHookOptions<NotificationSummaryDto>
) =>
  useQuery({
    gcTime: 5 * 60 * 1000,
    ...(options?.initialData ? { initialData: options.initialData } : {}),
    queryFn: getNotificationSummary,
    queryKey: queryKeys.notifications.summary(),
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {})
  });

export const useNotificationsQuery = (
  input: Partial<NotificationListQuery>
) =>
  useQuery({
    queryFn: () => getNotifications(input),
    queryKey: queryKeys.notifications.list(input),
    staleTime: 15 * 1000
  });

export const useProjectLabelsQuery = (
  workspaceSlug: string,
  projectKey: string | undefined,
  options?: QueryHookOptions<IssueLabelDto[]>
) =>
  useQuery({
    enabled: Boolean(projectKey) && (options?.enabled ?? true),
    ...(options?.initialData ? { initialData: options.initialData } : {}),
    queryFn: () => listProjectLabels(workspaceSlug, projectKey!),
    queryKey: queryKeys.project.labels(workspaceSlug, projectKey ?? "__none__"),
    staleTime: 5 * 60 * 1000
  });

export const useIssueSummariesQuery = (
  workspaceSlug: string,
  projectKey: string,
  scope: "all" | "assigned" | "created",
  options?: QueryHookOptions<IssueListItemDto[]>
) =>
  useQuery({
    ...(options?.initialData ? { initialData: options.initialData } : {}),
    queryFn: () => listProjectIssueSummaries(workspaceSlug, projectKey, scope),
    queryKey: queryKeys.issues.summary(workspaceSlug, projectKey, scope),
    staleTime: 30 * 1000,
    ...(options?.enabled !== undefined ? { enabled: options.enabled } : {})
  });

export const useIssueDetailQuery = (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string | undefined,
  options?: QueryHookOptions<IssueDetailDto>
) =>
  useQuery({
    enabled: Boolean(issueKey) && (options?.enabled ?? true),
    ...(options?.initialData ? { initialData: options.initialData } : {}),
    queryFn: () => getIssueByKey(workspaceSlug, projectKey, issueKey!),
    queryKey: queryKeys.issues.detail(workspaceSlug, projectKey, issueKey ?? "__none__"),
    staleTime: 15 * 1000
  });

export const useWorkspaceProjectsQuery = (
  workspaceSlug: string | undefined,
  options?: QueryHookOptions<ProjectSummaryDto[]>
) =>
  useQuery({
    enabled: Boolean(workspaceSlug) && (options?.enabled ?? true),
    ...(options?.initialData ? { initialData: options.initialData } : {}),
    queryFn: () => getProjectsForWorkspace(workspaceSlug!),
    queryKey: queryKeys.workspace.projects(workspaceSlug ?? "__none__"),
    staleTime: 60 * 1000
  });

export const useWorkspaceMembersQuery = (
  workspaceSlug: string,
  options?: QueryHookOptions<WorkspaceMemberDto[]>
) =>
  useQuery({
    enabled: options?.enabled ?? true,
    ...(options?.initialData ? { initialData: options.initialData } : {}),
    queryFn: () => getWorkspaceMembers(workspaceSlug),
    queryKey: queryKeys.workspace.members(workspaceSlug),
    staleTime: 60 * 1000
  });
