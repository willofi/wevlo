"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { MyIssuesTab, ProjectSummaryDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import { Tabs, TabsList, TabsTrigger } from "@wevlo/ui-web";

import { AppShell } from "@/components/app-shell";
import { IssueListTable } from "@/components/issue-list-table";
import { getMyIssues, getProjectsForWorkspace } from "@/lib/issue-hub-data";

type MyIssuesSurfaceProps = {
  initialProjectKey?: string;
  initialTab?: MyIssuesTab;
  initialWorkspaceSlug?: string;
  viewer: {
    avatarUrl?: string | null;
    email?: string | null;
    name: string;
  };
  workspaces: WorkspaceSummaryDto[];
};

const tabs: MyIssuesTab[] = ["assigned", "created", "subscribed", "activity"];

const tabLabel: Record<MyIssuesTab, string> = {
  activity: "Activity",
  assigned: "Assigned",
  created: "Created",
  subscribed: "Subscribed"
};

export function MyIssuesSurface({
  initialProjectKey,
  initialTab = "assigned",
  initialWorkspaceSlug,
  viewer,
  workspaces
}: MyIssuesSurfaceProps) {
  const router = useRouter();
  const [items, setItems] = useState<Array<Awaited<ReturnType<typeof getMyIssues>>["items"][number]>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectSummaryDto[]>([]);
  const [projectKey, setProjectKey] = useState(initialProjectKey ?? "");
  const [tab, setTab] = useState<MyIssuesTab>(initialTab);
  const [workspaceSlug, setWorkspaceSlug] = useState(initialWorkspaceSlug ?? "");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);

      try {
        const response = await getMyIssues({
          ...(projectKey ? { projectKey } : {}),
          tab,
          ...(workspaceSlug ? { workspaceSlug } : {})
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
  }, [projectKey, tab, workspaceSlug]);

  useEffect(() => {
    let cancelled = false;

    if (!workspaceSlug) {
      setProjects([]);
      setProjectKey("");
      return;
    }

    const loadProjects = async () => {
      const nextProjects = await getProjectsForWorkspace(workspaceSlug);

      if (!cancelled) {
        setProjects(nextProjects);

        if (projectKey && !nextProjects.some((project) => project.key === projectKey)) {
          setProjectKey("");
        }
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [projectKey, workspaceSlug]);

  useEffect(() => {
    const searchParams = new URLSearchParams();

    if (projectKey) {
      searchParams.set("project", projectKey);
    }

    if (tab !== "assigned") {
      searchParams.set("tab", tab);
    }

    if (workspaceSlug) {
      searchParams.set("workspace", workspaceSlug);
    }

    const query = searchParams.toString();
    router.replace(query.length > 0 ? `/my-issues?${query}` : "/my-issues", { scroll: false });
  }, [projectKey, router, tab, workspaceSlug]);

  const projectKeyById = Object.fromEntries(items.map((item) => [item.projectId, item.projectKey]));
  const workspaceNameByProjectId = Object.fromEntries(items.map((item) => [item.projectId, item.workspaceName]));
  const workspaceSlugByProjectId = Object.fromEntries(items.map((item) => [item.projectId, item.workspaceSlug]));

  return (
    <AppShell
      viewer={viewer}
      workspaces={workspaces}
      title="My issues"
      subtitle="A global personal hub for assigned, created, subscribed, and recent activity across your workspaces."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "My issues" }
      ]}
    >
      <div className="grid gap-4">
        <Tabs value={tab} onValueChange={(value) => setTab(value as MyIssuesTab)} className="grid gap-4">
          <TabsList>
            {tabs.map((currentTab) => (
              <TabsTrigger key={currentTab} value={currentTab}>
                {tabLabel[currentTab]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 md:flex-row">
          <select
            value={workspaceSlug}
            onChange={(event) => setWorkspaceSlug(event.target.value)}
            className="h-10 rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
          >
            <option value="">All workspaces</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.slug}>
                {workspace.name}
              </option>
            ))}
          </select>
          <select
            value={projectKey}
            onChange={(event) => setProjectKey(event.target.value)}
            className="h-10 rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground"
            disabled={workspaceSlug.length === 0}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.key}>
                {project.key} · {project.name}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="px-1 py-8 text-sm leading-6 text-muted-foreground">Loading your issues...</div>
        ) : (
          <IssueListTable
            issues={items.map((item) => item.issue)}
            projectKeyById={projectKeyById}
            showProject
            workspaceNameByProjectId={workspaceNameByProjectId}
            workspaceSlug=""
            workspaceSlugByProjectId={workspaceSlugByProjectId}
          />
        )}
      </div>
    </AppShell>
  );
}
