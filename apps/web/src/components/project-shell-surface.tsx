"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";

import type { IssueDetailDto, IssueListItemDto, IssueState, ProjectSummaryDto, WorkspaceMemberDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import { Button, cn } from "@wevlo/ui-web";

import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { IssueBoardView } from "@/components/issue-board-view";
import { IssueDetailInspector } from "@/components/issue-detail-inspector";
import { IssueListTable } from "@/components/issue-list-table";
import { PrototypeEmptyState } from "@/components/prototype-empty-state";
import { PrototypeShell } from "@/components/prototype-shell";
import { buildProjectShellHref, getIssueHref, transitionIssue } from "@/lib/issue-hub-data";
import {
  mergeIssueIntoSummaryCaches,
  prependIssueToSummaryCache,
  writeIssueDetailCache
} from "@/lib/query-cache-helpers";
import { useIssueDetailQuery, useIssueSummariesQuery } from "@/lib/query-hooks";
import { buildUserDirectory } from "@/lib/user-directory";

type ProjectShellSurfaceProps = {
  initialComposeOpen: boolean;
  initialIssueKey?: string;
  initialIssues: IssueListItemDto[];
  initialScope: "all" | "assigned" | "created";
  initialView: "list" | "board";
  project: ProjectSummaryDto;
  projects: ProjectSummaryDto[];
  viewer: {
    avatarUrl?: string | null;
    email?: string | null;
    id: string;
    name: string;
  };
  workspace: WorkspaceSummaryDto;
  workspaceMembers: WorkspaceMemberDto[];
  workspaces: WorkspaceSummaryDto[];
};

function countOpenIssues(issues: IssueListItemDto[]) {
  return issues.filter((issue) => issue.state !== "done" && issue.state !== "canceled").length;
}

export function ProjectShellSurface({
  initialComposeOpen,
  initialIssueKey,
  initialIssues,
  initialScope,
  initialView,
  project,
  projects,
  viewer,
  workspace,
  workspaceMembers,
  workspaces
}: ProjectShellSurfaceProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeIssueKey, setActiveIssueKey] = useState(initialIssueKey);
  const [currentView, setCurrentView] = useState(initialView);
  const [isComposeOpen, setIsComposeOpen] = useState(initialComposeOpen);
  const [composeState, setComposeState] = useState<IssueState | undefined>(undefined);
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<string[]>([]);
  const issueSummariesQuery = useIssueSummariesQuery(workspace.slug, project.key, initialScope, {
    initialData: initialIssues
  });
  const issues = issueSummariesQuery.data ?? [];
  const selectedIssueQuery = useIssueDetailQuery(workspace.slug, project.key, activeIssueKey, {
    enabled: Boolean(activeIssueKey)
  });

  useEffect(() => {
    setSelectedIssueKeys((current) => current.filter((issueKey) => issues.some((issue) => issue.issueKey === issueKey)));
  }, [issues]);

  useEffect(() => {
    setActiveIssueKey(initialIssueKey);
  }, [initialIssueKey]);

  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  useEffect(() => {
    setIsComposeOpen(initialComposeOpen);
  }, [initialComposeOpen]);

  const selectedIssue = selectedIssueQuery.data;
  const userDirectory = useMemo(() => buildUserDirectory(workspaceMembers), [workspaceMembers]);

  const projectHref = (options?: {
    compose?: boolean;
    issueKey?: string;
    view?: "list" | "board";
  }) => buildProjectShellHref(workspace.slug, project.key, options);

  const updateRoute = (options?: {
    compose?: boolean;
    issueKey?: string;
    view?: "list" | "board";
  }) => {
    router.replace(projectHref(options), { scroll: false });
  };

  const handleComposeChange = (open: boolean) => {
    setIsComposeOpen(open);
    if (!open) {
      setComposeState(undefined);
    }
    updateRoute({
      ...(currentView ? { view: currentView } : {}),
      ...(open ? { compose: true } : {}),
      ...(activeIssueKey ? { issueKey: activeIssueKey } : {})
    });
  };

  const handleCreateIssueWithState = (state: IssueState) => {
    setComposeState(state);
    setIsComposeOpen(true);
  };

  const handleViewChange = (view: "list" | "board") => {
    setCurrentView(view);
    updateRoute({
      ...(activeIssueKey ? { issueKey: activeIssueKey } : {}),
      view
    });
  };

  const handleIssueClose = () => {
    setActiveIssueKey(undefined);
    updateRoute({
      view: currentView
    });
  };

  const handleIssueOpen = (issueKey: string) => {
    setActiveIssueKey(issueKey);
    router.push(
      projectHref({
        issueKey,
        view: currentView
      }),
      { scroll: false }
    );
  };

  const handleIssueCreated = (
    issue: IssueDetailDto,
    createdProjectKey: string,
    options?: { keepComposerOpen?: boolean }
  ) => {
    if (createdProjectKey !== project.key) {
      setIsComposeOpen(Boolean(options?.keepComposerOpen));
      router.push(getIssueHref(workspace.slug, createdProjectKey, issue.issueKey));
      return;
    }

    writeIssueDetailCache(queryClient, {
      issue,
      projectKey: project.key,
      workspaceSlug: workspace.slug
    });
    prependIssueToSummaryCache(queryClient, {
      issue,
      projectKey: project.key,
      scope: initialScope,
      viewerUserId: viewer.id,
      workspaceSlug: workspace.slug
    });
    setActiveIssueKey(issue.issueKey);
    setIsComposeOpen(Boolean(options?.keepComposerOpen));

    if (!options?.keepComposerOpen) {
      updateRoute({
        issueKey: issue.issueKey,
        view: currentView
      });
    }
  };

  const handleIssueUpdated = (issue: IssueDetailDto) => {
    writeIssueDetailCache(queryClient, {
      issue,
      projectKey: project.key,
      workspaceSlug: workspace.slug
    });
    mergeIssueIntoSummaryCaches(queryClient, {
      currentScope: initialScope,
      issue,
      projectKey: project.key,
      viewerUserId: viewer.id,
      workspaceSlug: workspace.slug
    });
  };

  const handleTransition = async (issueKey: string, state: IssueState) => {
    const updated = await transitionIssue(workspace.slug, project.key, issueKey, { state });
    handleIssueUpdated(updated);
  };

  const handleIssueSelection = (issueKey: string, checked: boolean) => {
    setSelectedIssueKeys((current) =>
      checked ? [...new Set([...current, issueKey])] : current.filter((candidate) => candidate !== issueKey)
    );
  };

  const handleToggleAllIssues = (issueKeys: string[], checked: boolean) => {
    setSelectedIssueKeys(checked ? issueKeys : []);
  };

  return (
    <>
      <PrototypeShell
        currentProjectKey={project.key}
        currentWorkspaceSlug={workspace.slug}
        projects={projects}
        viewer={viewer}
        workspaceActionsContext={{
          currentProjectKey: project.key,
          projects,
          workspaceMembers,
          workspaceSlug: workspace.slug
        }}
        workspaces={workspaces.map((candidate) => ({ name: candidate.name, slug: candidate.slug }))}
      >
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {countOpenIssues(issues)} open · {issues.filter((issue) => issue.state === "done").length} done · {project.currentUserRole}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card/55 p-1">
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-full transition-colors",
                    currentView === "list"
                      ? "bg-secondary text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground"
                  )}
                  onClick={() => handleViewChange("list")}
                  aria-label="List view"
                  title="List view"
                >
                  <Rows3 className="size-4" />
                </button>
                <button
                  type="button"
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-full transition-colors",
                    currentView === "board"
                      ? "bg-secondary text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground"
                  )}
                  onClick={() => handleViewChange("board")}
                  aria-label="Board view"
                  title="Board view"
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {issues.length === 0 ? (
            <PrototypeEmptyState
              eyebrow="Project ready"
              title="No issue yet"
              description="Create the first issue in this project, then switch between list and board without leaving the shell."
              action={<Button onClick={() => handleComposeChange(true)}>Create issue</Button>}
            />
          ) : currentView === "board" ? (
            <IssueBoardView
              assigneeDirectory={userDirectory}
              issues={issues}
              onTransitionIssue={handleTransition}
              projectKey={project.key}
              workspaceSlug={workspace.slug}
              {...(selectedIssue ? { currentIssueKey: selectedIssue.issueKey } : {})}
            />
          ) : (
            <IssueListTable
              assigneeDirectory={userDirectory}
              issues={[...issues].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))}
              onIssueSelect={handleIssueOpen}
              onIssueUpdated={handleIssueUpdated}
              onCreateIssue={handleCreateIssueWithState}
              onToggleIssueGroup={handleToggleAllIssues}
              onToggleIssueSelection={handleIssueSelection}
              projectKeyById={{ [project.id]: project.key }}
              selectedIssueKeys={selectedIssueKeys}
              workspaceSlug={workspace.slug}
              workspaceMembers={workspaceMembers}
              {...(selectedIssue ? { currentIssueKey: selectedIssue.issueKey } : {})}
            />
          )}
        </div>
      </PrototypeShell>

      <IssueDetailInspector
        isLoading={selectedIssueQuery.isLoading}
        onClose={handleIssueClose}
        onIssueUpdated={handleIssueUpdated}
        projectKey={project.key}
        userDirectory={userDirectory}
        viewerUserId={viewer.id}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspace.slug}
        {...(activeIssueKey ? { issueKey: activeIssueKey } : {})}
        {...(selectedIssue ? { issue: selectedIssue } : {})}
      />

      <CreateIssueDialog
        initialState={composeState}
        onCreated={handleIssueCreated}
        onOpenChange={handleComposeChange}
        open={isComposeOpen}
        projectKey={project.key}
        projects={projects}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspace.slug}
      />
    </>
  );
}
