import type { NotificationListQuery } from "@wevlo/contracts";

const normalizeNotificationListFilter = (input: Partial<NotificationListQuery>) => ({
  category: input.category ?? null,
  projectId: input.projectId ?? null,
  status: input.status ?? "all",
  workspaceId: input.workspaceId ?? null
});

export const queryKeys = {
  notifications: {
    list: (input: Partial<NotificationListQuery> = {}) =>
      ["notifications", "list", normalizeNotificationListFilter(input)] as const,
    summary: () => ["notifications", "summary"] as const
  },
  issues: {
    detail: (workspaceSlug: string, projectKey: string, issueKey: string) =>
      ["issues", "detail", workspaceSlug, projectKey, issueKey] as const,
    summary: (workspaceSlug: string, projectKey: string, scope: "all" | "assigned" | "created") =>
      ["issues", "summary", workspaceSlug, projectKey, scope] as const
  },
  project: {
    labels: (workspaceSlug: string, projectKey: string) =>
      ["project", workspaceSlug, projectKey, "labels"] as const
  },
  workspace: {
    members: (workspaceSlug: string) => ["workspace", workspaceSlug, "members"] as const,
    projects: (workspaceSlug: string) => ["workspace", workspaceSlug, "projects"] as const
  }
};
