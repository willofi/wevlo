"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, MailOpen, MessageSquareMore, UserRoundPlus, UserRoundSearch } from "lucide-react";

import type { NotificationListStatus, ProjectSummaryDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@wevlo/ui-web";

import { useNotificationSummary } from "@/components/notification-summary-provider";
import {
  archiveNotifications,
  markAllNotificationsRead,
  markNotificationsRead
} from "@/lib/issue-hub-data";
import {
  optimisticMarkNotificationsRead,
  restoreNotificationSummary,
  updateNotificationListCache
} from "@/lib/query-cache-helpers";
import { useNotificationsQuery, useWorkspaceProjectsQuery } from "@/lib/query-hooks";
import { queryKeys } from "@/lib/query-keys";

type NotificationsPageClientProps = {
  initialProjectId?: string;
  initialStatus?: NotificationListStatus;
  initialWorkspaceId?: string;
  workspaces: WorkspaceSummaryDto[];
};

const categoryIcon = {
  access: UserRoundSearch,
  assignments: UserRoundPlus,
  comments: MessageSquareMore,
  invitations: MailOpen,
  mentions: Bell
} as const;

const statusOptions: Array<{
  label: string;
  value: NotificationListStatus;
}> = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Archived", value: "archived" }
];

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export function NotificationsPageClient({
  initialProjectId,
  initialStatus = "all",
  initialWorkspaceId,
  workspaces
}: NotificationsPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refresh } = useNotificationSummary();
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [status, setStatus] = useState<NotificationListStatus>(initialStatus);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? "");
  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId),
    [workspaceId, workspaces]
  );
  const notificationFilters = useMemo(
    () => ({
      ...(projectId ? { projectId } : {}),
      status,
      ...(workspaceId ? { workspaceId } : {})
    }),
    [projectId, status, workspaceId]
  );
  const notificationsQuery = useNotificationsQuery(notificationFilters);
  const workspaceProjectsQuery = useWorkspaceProjectsQuery(selectedWorkspace?.slug, {
    enabled: Boolean(selectedWorkspace)
  });
  const items = notificationsQuery.data?.items ?? [];
  const projects = workspaceProjectsQuery.data ?? [];
  const isLoading = notificationsQuery.isLoading;

  useEffect(() => {
    if (projectId && !projects.some((project) => project.id === projectId)) {
      setProjectId("");
    }
  }, [projectId, projects]);

  useEffect(() => {
    const searchParams = new URLSearchParams();

    if (projectId) {
      searchParams.set("project", projectId);
    }

    if (status !== "all") {
      searchParams.set("status", status);
    }

    if (workspaceId) {
      searchParams.set("workspace", workspaceId);
    }

    const query = searchParams.toString();
    router.replace(query.length > 0 ? `/notifications?${query}` : "/notifications", { scroll: false });
  }, [projectId, router, status, workspaceId]);

  const markReadMutation = useMutation({
    mutationFn: markNotificationsRead,
    onError: (_error, _ids, context) => {
      restoreNotificationSummary(queryClient, context?.previousSummary);
    },
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.summary() });
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.list(notificationFilters) });

      const previousSummary = optimisticMarkNotificationsRead(queryClient, ids);
      updateNotificationListCache(queryClient, {
        filters: notificationFilters,
        updater: (current) => ({
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
          unreadCount: Math.max(0, current.unreadCount - current.items.filter((item) => item.readAt === null && ids.includes(item.id)).length),
          unseenCount: Math.max(0, current.unseenCount - current.items.filter((item) => item.seenAt === null && ids.includes(item.id)).length)
        })
      });

      return { previousSummary };
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.summary() });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: archiveNotifications,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.summary() });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.summary() });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    }
  });

  const handleItemOpen = async (id: string, href: string) => {
    await markReadMutation.mutateAsync([id]);
    router.push(href);
  };

  const handleArchive = async (id: string) => {
    await archiveMutation.mutateAsync([id]);
    await refresh();
  };

  const handleMarkAllRead = async () => {
    await markAllReadMutation.mutateAsync();
    await refresh();
  };

  return (
    <div className="grid gap-4">
      <Card className="shadow-none">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Inbox</CardTitle>
              <p className="text-sm text-muted-foreground">
                Mentions, assignments, comments, and access changes land here so you can jump straight into action.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                    status === option.value
                      ? "border-primary/50 bg-primary text-primary-foreground"
                      : "border-border/70 bg-background/60 text-foreground hover:bg-secondary/70"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className="h-10 rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
            >
              <option value="">All workspaces</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-10 rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
              disabled={workspaceId.length === 0}
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.key} · {project.name}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => void handleMarkAllRead()}>
              Mark all read
            </Button>
          </div>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card className="shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground">Loading inbox...</CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground">Nothing here right now.</CardContent>
        </Card>
      ) : (
        items.map((item) => {
          const Icon = categoryIcon[item.category];

          return (
            <Card key={item.id} className="shadow-none transition-colors hover:bg-secondary/20">
              <CardContent className="flex items-start gap-3 p-4">
                <button type="button" onClick={() => void handleItemOpen(item.id, item.href)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.title}</span>
                      {item.readAt === null ? <span className="size-2 rounded-full bg-primary" /> : null}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.body}</span>
                    <span className="mt-2 block text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                  </span>
                </button>
                {item.archivedAt === null ? (
                  <Button variant="ghost" size="sm" onClick={() => void handleArchive(item.id)}>
                    Archive
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
