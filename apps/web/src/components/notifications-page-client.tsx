"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, MailOpen, MessageSquareMore, UserRoundPlus, UserRoundSearch } from "lucide-react";

import type { NotificationListStatus, ProjectSummaryDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@wevlo/ui-web";

import { useNotificationSummary } from "@/components/notification-summary-provider";
import {
  archiveNotifications,
  getNotifications,
  getProjectsForWorkspace,
  markAllNotificationsRead,
  markNotificationsRead
} from "@/lib/issue-hub-data";

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
  const { refresh } = useNotificationSummary();
  const [items, setItems] = useState<Array<Awaited<ReturnType<typeof getNotifications>>["items"][number]>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectSummaryDto[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [status, setStatus] = useState<NotificationListStatus>(initialStatus);
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? "");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);

      try {
        const response = await getNotifications({
          ...(projectId ? { projectId } : {}),
          status,
          ...(workspaceId ? { workspaceId } : {})
        });

        if (!cancelled) {
          setItems(response.items);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [projectId, status, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);

    if (!selectedWorkspace) {
      setProjects([]);
      setProjectId("");
      return;
    }

    const loadProjects = async () => {
      const nextProjects = await getProjectsForWorkspace(selectedWorkspace.slug);

      if (!cancelled) {
        setProjects(nextProjects);

        if (projectId && !nextProjects.some((project) => project.id === projectId)) {
          setProjectId("");
        }
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceId, workspaces]);

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

  const handleItemOpen = async (id: string, href: string) => {
    await markNotificationsRead([id]);
    await refresh();
    router.push(href);
  };

  const handleArchive = async (id: string) => {
    await archiveNotifications([id]);
    await refresh();
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await refresh();
    setItems((current) =>
      current.map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
        seenAt: item.seenAt ?? new Date().toISOString()
      }))
    );
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
