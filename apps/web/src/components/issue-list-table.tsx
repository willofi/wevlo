"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useMemo } from "react";

import type { IssueDetailDto } from "@wevlo/contracts";
import { Avatar, AvatarFallback, cn } from "@wevlo/ui-web";

import { getIssueHref } from "@/lib/issue-hub-data";
import type { UserDirectory } from "@/lib/user-directory";
import { getDirectoryUserLabel } from "@/lib/user-directory";

type IssueListTableProps = {
  assigneeDirectory?: UserDirectory;
  currentIssueKey?: string;
  issues: IssueDetailDto[];
  onIssueSelect?: (issueKey: string) => void;
  onToggleIssueGroup?: (issueKeys: string[], checked: boolean) => void;
  onToggleIssueSelection?: (issueKey: string, checked: boolean) => void;
  projectKeyById: Record<string, string>;
  selectedIssueKeys?: string[];
  showProject?: boolean;
  workspaceSlug: string;
};

const stateOrder: IssueDetailDto["state"][] = ["backlog", "todo", "in_progress", "done", "canceled"];

const stateLabel: Record<IssueDetailDto["state"], string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled"
};

const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium"
  }).format(new Date(value));

export function IssueListTable({
  assigneeDirectory = {},
  currentIssueKey,
  issues,
  onIssueSelect,
  onToggleIssueGroup,
  onToggleIssueSelection,
  projectKeyById,
  selectedIssueKeys = [],
  showProject = false,
  workspaceSlug
}: IssueListTableProps) {
  const router = useRouter();
  const selectedIssueKeySet = useMemo(() => new Set(selectedIssueKeys), [selectedIssueKeys]);
  const groupedIssues = useMemo(
    () =>
      stateOrder
        .map((state) => ({
          issues: issues
            .filter((issue) => issue.state === state)
            .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
          state
        }))
        .filter((section) => section.issues.length > 0),
    [issues]
  );

  if (issues.length === 0) {
    return (
      <div className="px-1 py-8 text-sm leading-6 text-muted-foreground">
        No issues yet. Create the first issue to start shaping the board.
      </div>
    );
  }

  const openIssue = (href: string, issueKey: string) => {
    if (onIssueSelect) {
      onIssueSelect(issueKey);
      return;
    }

    router.push(href, { scroll: false });
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, href: string | undefined, issueKey: string) => {
    if (!href) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openIssue(href, issueKey);
    }
  };

  return (
    <div className="space-y-5">
      {groupedIssues.map((section) => (
        <section key={section.state} className="space-y-1">
          <div className="flex items-center justify-between gap-3 px-1 py-1 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-3.5 rounded border border-border/80 bg-transparent accent-[hsl(var(--primary))]"
                checked={section.issues.every((issue) => selectedIssueKeySet.has(issue.issueKey))}
                onChange={(event) =>
                  onToggleIssueGroup?.(
                    section.issues.map((issue) => issue.issueKey),
                    event.target.checked
                  )
                }
              />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {stateLabel[section.state]}
              </span>
              <span className="text-xs text-muted-foreground">{section.issues.length}</span>
            </label>
            {section.issues.some((issue) => selectedIssueKeySet.has(issue.issueKey)) ? (
              <div className="text-xs text-muted-foreground">
                {section.issues.filter((issue) => selectedIssueKeySet.has(issue.issueKey)).length} selected
              </div>
            ) : null}
          </div>

          <ul className="space-y-px">
            {section.issues.map((issue) => {
              const projectKey = projectKeyById[issue.projectId];
              const href = projectKey
                ? getIssueHref(workspaceSlug, projectKey, issue.issueKey)
                : undefined;
              const isSelected = selectedIssueKeySet.has(issue.issueKey);

              return (
                <li key={issue.id}>
                  <div
                    className={cn(
                      "grid cursor-pointer grid-cols-[28px_88px_minmax(0,1fr)_220px_112px] items-center gap-3 px-1 py-2 transition-colors",
                      issue.issueKey === currentIssueKey && "bg-secondary/38",
                      issue.issueKey !== currentIssueKey && "hover:bg-secondary/18"
                    )}
                    onClick={() => href && openIssue(href, issue.issueKey)}
                    onKeyDown={(event) => handleRowKeyDown(event, href, issue.issueKey)}
                    role={href ? "button" : undefined}
                    tabIndex={href ? 0 : undefined}
                  >
                    <div
                      className="flex items-center justify-center"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border border-border/80 bg-transparent accent-[hsl(var(--primary))]"
                        checked={isSelected}
                        onChange={(event) => onToggleIssueSelection?.(issue.issueKey, event.target.checked)}
                      />
                    </div>

                    <div className="truncate font-mono text-[11px] text-muted-foreground">{issue.issueKey}</div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{issue.title}</div>
                      {showProject && projectKey ? (
                        <div className="truncate text-[11px] text-muted-foreground">{projectKey}</div>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      {issue.assigneeUserId ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Avatar className="size-5 border border-border/60 bg-secondary/60">
                            <AvatarFallback className="bg-transparent text-[10px] font-semibold text-foreground">
                              {assigneeDirectory[issue.assigneeUserId]?.initials ?? "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {getDirectoryUserLabel(assigneeDirectory, issue.assigneeUserId)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Unassigned</div>
                      )}
                    </div>

                    <div className="text-right text-sm text-muted-foreground">{formatUpdatedAt(issue.updatedAt)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
