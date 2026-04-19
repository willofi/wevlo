"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@wevlo/ui-web";
import type { IssueDetailDto } from "@wevlo/contracts";

import { AppShell } from "@/components/app-shell";
import { IssueListTable } from "@/components/issue-list-table";

type MyIssuesSurfaceProps = {
  assignedIssues: IssueDetailDto[];
  createdIssues: IssueDetailDto[];
  recentIssues: IssueDetailDto[];
  projectKeyById: Record<string, string>;
  viewer: {
    email?: string | null;
    name: string;
  };
  workspaceName: string;
  workspaceSlug: string;
  workspaces: Array<{
    name: string;
    slug: string;
  }>;
};

export function MyIssuesSurface({
  assignedIssues,
  createdIssues,
  recentIssues,
  projectKeyById,
  viewer,
  workspaceName,
  workspaceSlug,
  workspaces
}: MyIssuesSurfaceProps) {
  return (
    <AppShell
      viewer={viewer}
      workspaces={workspaces}
      currentWorkspaceSlug={workspaceSlug}
      title="My issues"
      subtitle={`Focused work across ${workspaceName}. Jump between assigned, created, and recently updated items without scanning every project.`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: workspaceName, href: `/${workspaceSlug}` },
        { label: "My issues" }
      ]}
    >
      <Tabs defaultValue="assigned" className="grid gap-4">
        <TabsList>
          <TabsTrigger value="assigned">Assigned</TabsTrigger>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
        </TabsList>
        <TabsContent value="assigned">
          <IssueListTable issues={assignedIssues} projectKeyById={projectKeyById} showProject workspaceSlug={workspaceSlug} />
        </TabsContent>
        <TabsContent value="created">
          <IssueListTable issues={createdIssues} projectKeyById={projectKeyById} showProject workspaceSlug={workspaceSlug} />
        </TabsContent>
        <TabsContent value="recent">
          <IssueListTable issues={recentIssues} projectKeyById={projectKeyById} showProject workspaceSlug={workspaceSlug} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
