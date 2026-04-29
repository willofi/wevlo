"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, Tag, UserCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import type { IssueDetailDto, IssueLabelDto, IssueListItemDto, IssuePriority, WorkspaceMemberDto } from "@wevlo/contracts";
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn
} from "@wevlo/ui-web";

import { DropdownSearchInput } from "@/components/issue-metadata-primitives";
import { getIssueHref, listProjectLabels, transitionIssue, updateIssue } from "@/lib/issue-hub-data";
import {
  buildProjectStateOptions,
  getPriorityIcon,
  getProjectStatePresentation,
  labelColorClasses,
  priorityOptions,
  priorityToneClasses,
  renderProjectBoardIcon
} from "@/lib/issue-presentation";
import type { UserDirectory } from "@/lib/user-directory";
import { queryKeys } from "@/lib/query-keys";

type IssueListTableProps = {
  assigneeDirectory?: UserDirectory;
  currentIssueKey?: string;
  issues: IssueListItemDto[];
  onIssueSelect?: (issueKey: string) => void;
  onIssueUpdated?: (issue: IssueDetailDto) => void;
  onCreateIssue?: (state: IssueDetailDto["state"]) => void;
  onToggleIssueGroup?: (issueKeys: string[], checked: boolean) => void;
  onToggleIssueSelection?: (issueKey: string, checked: boolean) => void;
  projectKeyById: Record<string, string>;
  selectedIssueKeys?: string[];
  showProject?: boolean;
  workspaceSlug: string;
  workspaceMembers?: WorkspaceMemberDto[];
  workspaceNameByProjectId?: Record<string, string>;
  workspaceSlugByProjectId?: Record<string, string>;
};

const stateOrder: IssueListItemDto["state"][] = ["backlog", "todo", "in_progress", "done", "canceled"];

const stateLabel: Record<IssueListItemDto["state"], string> = {
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
  onIssueUpdated,
  onCreateIssue,
  onToggleIssueSelection,
  projectKeyById,
  selectedIssueKeys = [],
  showProject = false,
  workspaceSlug,
  workspaceMembers = [],
  workspaceSlugByProjectId = {}
}: IssueListTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [localIssues, setLocalIssues] = useState<IssueListItemDto[]>(issues);
  const [collapsedStates, setCollapsedStates] = useState<Record<IssueListItemDto["state"], boolean>>({
    backlog: false,
    todo: false,
    in_progress: false,
    done: false,
    canceled: false
  });
  const [busyPriorityIssueId, setBusyPriorityIssueId] = useState<string | null>(null);
  const [busyAssigneeIssueId, setBusyAssigneeIssueId] = useState<string | null>(null);
  const [busyLabelsIssueId, setBusyLabelsIssueId] = useState<string | null>(null);
  const [busyStateIssueId, setBusyStateIssueId] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [labelsByProjectId, setLabelsByProjectId] = useState<Record<string, IssueLabelDto[]>>({});

  useEffect(() => {
    setLocalIssues(issues);
  }, [issues]);

  useEffect(() => {
    const projectIds = Array.from(new Set(localIssues.map((issue) => issue.projectId)));
    const missingProjectIds = projectIds.filter((id) => !labelsByProjectId[id]);

    if (missingProjectIds.length === 0) {
      return;
    }

    void (async () => {
      for (const projectId of missingProjectIds) {
        const projectKey = projectKeyById[projectId];
        if (projectKey) {
          try {
            const labels = await queryClient.fetchQuery({
              queryFn: () => listProjectLabels(workspaceSlug, projectKey),
              queryKey: queryKeys.project.labels(workspaceSlug, projectKey),
              staleTime: 5 * 60 * 1000
            });
            setLabelsByProjectId((current) => ({
              ...current,
              [projectId]: labels
            }));
          } catch {
            setLabelsByProjectId((current) => ({
              ...current,
              [projectId]: []
            }));
          }
        }
      }
    })();
  }, [localIssues, labelsByProjectId, projectKeyById, queryClient, workspaceSlug]);

  const selectedIssueKeySet = useMemo(() => new Set(selectedIssueKeys), [selectedIssueKeys]);
  const stateOptions = useMemo(() => buildProjectStateOptions(undefined), []);
  const groupedIssues = useMemo(
    () =>
      stateOrder
        .map((state) => ({
          issues: localIssues
            .filter((issue) => issue.state === state)
            .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
          state
        }))
        .filter((section) => section.issues.length > 0),
    [localIssues]
  );

  const filteredMembers = useMemo(() => {
    const needle = assigneeSearch.trim().toLowerCase();
    if (!needle) {
      return workspaceMembers;
    }

    return workspaceMembers.filter((member) =>
      member.user.name.toLowerCase().includes(needle) ||
      member.user.handle.toLowerCase().includes(needle)
    );
  }, [assigneeSearch, workspaceMembers]);

  if (localIssues.length === 0) {
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

  const handlePriorityChange = async (
    issue: IssueListItemDto,
    nextPriority: IssuePriority,
    rowWorkspaceSlug: string,
    projectKey: string
  ) => {
    if (issue.priority === nextPriority) {
      return;
    }

    const previousIssues = localIssues;
    setBusyPriorityIssueId(issue.id);
    setLocalIssues((current) =>
      current.map((candidate) =>
        candidate.id === issue.id
          ? {
              ...candidate,
              priority: nextPriority
            }
          : candidate
      )
    );

    try {
      const updated = await updateIssue(rowWorkspaceSlug, projectKey, issue.issueKey, { priority: nextPriority });
      setLocalIssues((current) => current.map((candidate) => (candidate.id === issue.id ? updated : candidate)));
      onIssueUpdated?.(updated);
    } catch {
      setLocalIssues(previousIssues);
    } finally {
      setBusyPriorityIssueId(null);
    }
  };

  const handleAssigneeChange = async (
    issue: IssueListItemDto,
    nextAssigneeUserId: string | null,
    rowWorkspaceSlug: string,
    projectKey: string
  ) => {
    if (issue.assigneeUserId === nextAssigneeUserId) {
      return;
    }

    const previousIssues = localIssues;
    setBusyAssigneeIssueId(issue.id);
    setLocalIssues((current) =>
      current.map((candidate) =>
        candidate.id === issue.id
          ? {
              ...candidate,
              assigneeUserId: nextAssigneeUserId
            }
          : candidate
      )
    );

    try {
      const updated = await updateIssue(rowWorkspaceSlug, projectKey, issue.issueKey, { assigneeUserId: nextAssigneeUserId });
      setLocalIssues((current) => current.map((candidate) => (candidate.id === issue.id ? updated : candidate)));
      onIssueUpdated?.(updated);
    } catch {
      setLocalIssues(previousIssues);
    } finally {
      setBusyAssigneeIssueId(null);
    }
  };

  const handleLabelChange = async (
    issue: IssueListItemDto,
    nextLabelIds: string[],
    rowWorkspaceSlug: string,
    projectKey: string
  ) => {
    const previousIssues = localIssues;
    setBusyLabelsIssueId(issue.id);

    // Optimistic update
    const projectLabels = labelsByProjectId[issue.projectId] ?? [];
    const nextLabels = projectLabels.filter((label) => nextLabelIds.includes(label.id));

    setLocalIssues((current) =>
      current.map((candidate) =>
        candidate.id === issue.id
          ? {
              ...candidate,
              labels: nextLabels
            }
          : candidate
      )
    );

    try {
      const updated = await updateIssue(rowWorkspaceSlug, projectKey, issue.issueKey, { labelIds: nextLabelIds });
      setLocalIssues((current) => current.map((candidate) => (candidate.id === issue.id ? updated : candidate)));
      onIssueUpdated?.(updated);
    } catch {
      setLocalIssues(previousIssues);
    } finally {
      setBusyLabelsIssueId(null);
    }
  };

  const handleStateChange = async (
    issue: IssueListItemDto,
    nextState: IssueListItemDto["state"],
    rowWorkspaceSlug: string,
    projectKey: string
  ) => {
    if (issue.state === nextState) {
      return;
    }

    const previousIssues = localIssues;
    setBusyStateIssueId(issue.id);

    setLocalIssues((current) =>
      current.map((candidate) =>
        candidate.id === issue.id
          ? {
              ...candidate,
              state: nextState
            }
          : candidate
      )
    );

    try {
      const updated = await transitionIssue(rowWorkspaceSlug, projectKey, issue.issueKey, { state: nextState });
      setLocalIssues((current) => current.map((candidate) => (candidate.id === issue.id ? updated : candidate)));
      onIssueUpdated?.(updated);
    } catch {
      setLocalIssues(previousIssues);
    } finally {
      setBusyStateIssueId(null);
    }
  };

  return (
    <div className="space-y-4">
      {groupedIssues.map((section) => {
        const statePresentation = getProjectStatePresentation(section.state, undefined);
        const bgClass = {
          backlog: "bg-slate-500/5 hover:bg-slate-500/10",
          todo: "bg-amber-500/5 hover:bg-amber-500/10",
          in_progress: "bg-blue-500/5 hover:bg-blue-500/10",
          done: "bg-emerald-500/5 hover:bg-emerald-500/10",
          canceled: "bg-slate-500/5 hover:bg-slate-500/10"
        }[section.state];

        return (
          <section key={section.state} className="space-y-0.5">
            <div className={cn("group/header flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors", bgClass)}>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-left"
                onClick={() =>
                  setCollapsedStates((current) => ({
                    ...current,
                    [section.state]: !current[section.state]
                  }))
                }
              >
                <div className="flex size-5 items-center justify-center">
                  {collapsedStates[section.state] ? (
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <span className="text-muted-foreground">
                  {renderProjectBoardIcon(statePresentation.iconKey, "size-4")}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/80">
                  {stateLabel[section.state]}
                </span>
                <span className="text-xs font-medium text-muted-foreground/70">{section.issues.length}</span>
              </button>
              
              <div className="flex items-center gap-3">
                {section.issues.some((issue) => selectedIssueKeySet.has(issue.issueKey)) ? (
                  <div className="text-[11px] font-medium text-muted-foreground/60">
                    {section.issues.filter((issue) => selectedIssueKeySet.has(issue.issueKey)).length} selected
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => onCreateIssue?.(section.state)}
                  className="flex size-5 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-secondary/80 hover:text-foreground opacity-0 group-hover/header:opacity-100"
                  title={`Create issue in ${stateLabel[section.state]}`}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            <ul className={cn("space-y-px", collapsedStates[section.state] && "hidden")}>
              {section.issues.map((issue) => {
                const projectKey = projectKeyById[issue.projectId];
                const rowWorkspaceSlug = workspaceSlugByProjectId[issue.projectId] ?? workspaceSlug;
                const href = projectKey
                  ? getIssueHref(rowWorkspaceSlug, projectKey, issue.issueKey)
                  : undefined;
                const isSelected = selectedIssueKeySet.has(issue.issueKey);

                return (
                  <li key={issue.id}>
                    <div
                      className={cn(
                        "group grid cursor-pointer grid-cols-[24px_24px_50px_24px_minmax(0,1fr)_180px_100px] items-center gap-1.5 px-1 py-1 transition-colors",
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
                          className={cn(
                            "size-3.5 rounded border border-border/80 bg-transparent accent-[hsl(var(--primary))] transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
                          checked={isSelected}
                          onChange={(event) => onToggleIssueSelection?.(issue.issueKey, event.target.checked)}
                        />
                      </div>

                      <div
                        className="flex items-center justify-center"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-md transition-colors hover:bg-secondary/70",
                                priorityToneClasses[issue.priority],
                                busyPriorityIssueId === issue.id && "opacity-60"
                              )}
                              aria-label="Change priority"
                              disabled={!projectKey || busyPriorityIssueId === issue.id}
                            >
                              {getPriorityIcon(issue.priority)}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            {priorityOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onSelect={() => {
                                  if (!projectKey) {
                                    return;
                                  }
                                  void handlePriorityChange(issue, option.value, rowWorkspaceSlug, projectKey);
                                }}
                              >
                                <span className={cn("mr-2", priorityToneClasses[option.value])}>{getPriorityIcon(option.value)}</span>
                                {option.label}
                                {issue.priority === option.value ? <Check className="ml-auto size-4" /> : null}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center truncate font-mono text-[11px] leading-none text-muted-foreground">
                        {issue.issueKey}
                      </div>

                      <div
                        className="flex items-center justify-center"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu onOpenChange={(open) => !open && setStateSearch("")}>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-md transition-colors hover:bg-secondary/70",
                                busyStateIssueId === issue.id && "opacity-60"
                              )}
                              disabled={!projectKey || busyStateIssueId === issue.id}
                            >
                              {renderProjectBoardIcon(getProjectStatePresentation(issue.state, undefined).iconKey, "size-4")}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52">
                            <DropdownSearchInput placeholder="Search status..." value={stateSearch} onChange={setStateSearch} />
                            {stateOptions
                              .filter((option) => option.label.toLowerCase().includes(stateSearch.toLowerCase()))
                              .map((option) => (
                                <DropdownMenuItem
                                  key={option.value}
                                  onSelect={() => {
                                    if (!projectKey) {
                                      return;
                                    }
                                    void handleStateChange(issue, option.value, rowWorkspaceSlug, projectKey);
                                  }}
                                >
                                  <span className="mr-2 text-muted-foreground">{renderProjectBoardIcon(option.iconKey, "size-4")}</span>
                                  {option.label}
                                  {issue.state === option.value ? <Check className="ml-auto size-4" /> : null}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{issue.title}</div>
                      </div>

                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                        {showProject && projectKey ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                            <Tag className="size-3" />
                            {projectKey}
                          </span>
                        ) : null}

                        <div
                          className="flex items-center"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu onOpenChange={(open) => !open && setLabelSearch("")}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-secondary/70",
                                  (issue.labels ?? []).length === 0 && "text-muted-foreground/40 hover:text-muted-foreground",
                                  busyLabelsIssueId === issue.id && "opacity-60"
                                )}
                              disabled={!projectKey || busyLabelsIssueId === issue.id}
                            >
                                {(issue.labels ?? []).length > 0 ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    {(issue.labels ?? []).map((label) => (
                                      <span
                                        key={label.id}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                                      >
                                        <span className={cn("size-2 rounded-full", labelColorClasses[label.color] ?? "bg-slate-500")} />
                                        {label.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <Tag className="size-4" />
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                              <DropdownSearchInput
                                placeholder="Search labels..."
                                value={labelSearch}
                                onChange={setLabelSearch}
                              />
                              <DropdownMenuSeparator />
                              {(() => {
                                const projectLabels = labelsByProjectId[issue.projectId] ?? [];
                                const filtered = projectLabels.filter((l) =>
                                  l.name.toLowerCase().includes(labelSearch.toLowerCase())
                                );

                                if (filtered.length === 0) {
                                  return <div className="px-2 py-1.5 text-xs text-muted-foreground">No labels found</div>;
                                }

                                return filtered.map((label) => (
                                  <DropdownMenuCheckboxItem
                                    key={label.id}
                                    checked={(issue.labels ?? []).some((current) => current.id === label.id)}
                                    onCheckedChange={(checked) => {
                                      if (!projectKey) return;
                                      const nextLabelIds = checked
                                        ? [...new Set([...(issue.labels ?? []).map((l) => l.id), label.id])]
                                        : (issue.labels ?? []).map((l) => l.id).filter((id) => id !== label.id);
                                      void handleLabelChange(issue, nextLabelIds, rowWorkspaceSlug, projectKey);
                                    }}
                                  >
                                    <span className={cn("mr-2 size-2 rounded-full", labelColorClasses[label.color] ?? "bg-slate-500")} />
                                    {label.name}
                                  </DropdownMenuCheckboxItem>
                                ));
                              })()}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div
                          className="flex items-center"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu onOpenChange={(open) => !open && setAssigneeSearch("")}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  "flex items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-secondary/70",
                                  !issue.assigneeUserId && "text-muted-foreground/60 hover:text-muted-foreground",
                                  busyAssigneeIssueId === issue.id && "opacity-60"
                                )}
                                disabled={!projectKey || busyAssigneeIssueId === issue.id}
                              >
                                {issue.assigneeUserId ? (
                                  <Avatar className="size-5 border border-border/60 bg-secondary/60">
                                    <AvatarFallback className="bg-transparent text-[10px] font-semibold text-foreground">
                                      {assigneeDirectory[issue.assigneeUserId]?.initials ?? "U"}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <UserCircle className="size-5" />
                                )}
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownSearchInput
                                placeholder="Search assignee..."
                                value={assigneeSearch}
                                onChange={setAssigneeSearch}
                              />
                              <DropdownMenuItem onSelect={() => projectKey && handleAssigneeChange(issue, null, rowWorkspaceSlug, projectKey)}>
                                <UserCircle className="mr-2 size-4 text-muted-foreground" />
                                No assignee
                                {!issue.assigneeUserId ? <Check className="ml-auto size-4" /> : null}
                              </DropdownMenuItem>
                              {filteredMembers.map((member) => (
                                <DropdownMenuItem
                                  key={member.userId}
                                  onSelect={() => projectKey && handleAssigneeChange(issue, member.userId, rowWorkspaceSlug, projectKey)}
                                >
                                  <span className="mr-2 flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                                    {member.user.name.slice(0, 1).toUpperCase()}
                                    </span>
                                  <span className="truncate">{member.user.name}</span>
                                  {issue.assigneeUserId === member.userId ? <Check className="ml-auto size-4" /> : null}
                                </DropdownMenuItem>
                              ))}
                              {filteredMembers.length === 0 && (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">No users found</div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="text-right text-sm text-muted-foreground">{formatUpdatedAt(issue.updatedAt)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
