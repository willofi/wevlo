"use client";

import type { QueryClient } from "@tanstack/react-query";

import type {
  IssueDetailDto,
  IssueListItemDto,
  NotificationListQuery,
  NotificationListResponseDto,
  NotificationSummaryDto
} from "@wevlo/contracts";

import { issueSummaryScopes, sortIssueSummaries, toIssueSummary } from "@/lib/query-hooks";
import { queryKeys } from "@/lib/query-keys";

const matchesScope = (
  issue: IssueListItemDto,
  viewerUserId: string,
  scope: "all" | "assigned" | "created"
): boolean => {
  if (scope === "assigned") {
    return issue.assigneeUserId === viewerUserId;
  }

  if (scope === "created") {
    return issue.reporterUserId === viewerUserId;
  }

  return true;
};

export const writeIssueDetailCache = (
  queryClient: QueryClient,
  input: {
    issue: IssueDetailDto;
    projectKey: string;
    workspaceSlug: string;
  }
) => {
  queryClient.setQueryData(
    queryKeys.issues.detail(input.workspaceSlug, input.projectKey, input.issue.issueKey),
    input.issue
  );
};

export const mergeIssueIntoSummaryCaches = (
  queryClient: QueryClient,
  input: {
    currentScope?: "all" | "assigned" | "created";
    issue: IssueDetailDto;
    projectKey: string;
    viewerUserId: string;
    workspaceSlug: string;
  }
) => {
  const summary = toIssueSummary(input.issue);

  for (const scope of issueSummaryScopes) {
    queryClient.setQueryData<IssueListItemDto[] | undefined>(
      queryKeys.issues.summary(input.workspaceSlug, input.projectKey, scope),
      (current) => {
        if (!current) {
          return current;
        }

        const filtered = current.filter((candidate) => candidate.id !== input.issue.id);

        if (!matchesScope(summary, input.viewerUserId, scope)) {
          return filtered;
        }

        return sortIssueSummaries([summary, ...filtered]);
      }
    );
  }

  if (input.currentScope) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.issues.summary(input.workspaceSlug, input.projectKey, input.currentScope)
    });
  } else {
    queryClient.invalidateQueries({
      queryKey: ["issues", "summary", input.workspaceSlug, input.projectKey]
    });
  }
};

export const prependIssueToSummaryCache = (
  queryClient: QueryClient,
  input: {
    issue: IssueDetailDto;
    projectKey: string;
    scope: "all" | "assigned" | "created";
    viewerUserId: string;
    workspaceSlug: string;
  }
) => {
  const summary = toIssueSummary(input.issue);

  if (!matchesScope(summary, input.viewerUserId, input.scope)) {
    return;
  }

  queryClient.setQueryData<IssueListItemDto[] | undefined>(
    queryKeys.issues.summary(input.workspaceSlug, input.projectKey, input.scope),
    (current) => sortIssueSummaries([summary, ...(current ?? []).filter((candidate) => candidate.id !== input.issue.id)])
  );
  queryClient.invalidateQueries({
    queryKey: ["issues", "summary", input.workspaceSlug, input.projectKey]
  });
};

export const optimisticMarkNotificationsSeen = (
  queryClient: QueryClient,
  ids: string[]
): NotificationSummaryDto | undefined => {
  const previous = queryClient.getQueryData<NotificationSummaryDto>(queryKeys.notifications.summary());

  queryClient.setQueryData<NotificationSummaryDto | undefined>(queryKeys.notifications.summary(), (current) => {
    if (!current) {
      return current;
    }

    const unseenCountDelta = current.items.filter((item) => item.seenAt === null && ids.includes(item.id)).length;

    return {
      ...current,
      items: current.items.map((item) =>
        ids.includes(item.id) ? { ...item, seenAt: item.seenAt ?? new Date().toISOString() } : item
      ),
      unseenCount: Math.max(0, current.unseenCount - unseenCountDelta)
    };
  });

  return previous;
};

export const optimisticMarkNotificationsRead = (
  queryClient: QueryClient,
  ids: string[]
): NotificationSummaryDto | undefined => {
  const previous = queryClient.getQueryData<NotificationSummaryDto>(queryKeys.notifications.summary());

  queryClient.setQueryData<NotificationSummaryDto | undefined>(queryKeys.notifications.summary(), (current) => {
    if (!current) {
      return current;
    }

    const unseenCountDelta = current.items.filter((item) => item.seenAt === null && ids.includes(item.id)).length;

    return {
      ...current,
      items: current.items.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              readAt: item.readAt ?? new Date().toISOString(),
              seenAt: item.seenAt ?? new Date().toISOString()
            }
          : item
      ),
      unseenCount: Math.max(0, current.unseenCount - unseenCountDelta)
    };
  });

  return previous;
};

export const restoreNotificationSummary = (
  queryClient: QueryClient,
  previous: NotificationSummaryDto | undefined
) => {
  if (previous) {
    queryClient.setQueryData(queryKeys.notifications.summary(), previous);
  }
};

export const updateNotificationListCache = (
  queryClient: QueryClient,
  input: {
    filters: Partial<NotificationListQuery>;
    updater: (current: NotificationListResponseDto) => NotificationListResponseDto;
  }
) => {
  queryClient.setQueryData<NotificationListResponseDto | undefined>(
    queryKeys.notifications.list(input.filters),
    (current) => (current ? input.updater(current) : current)
  );
};
