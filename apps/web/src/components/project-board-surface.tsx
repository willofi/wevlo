"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CircleDot, LayoutTemplate, MoreHorizontal, PanelTopOpen, Rows3, TriangleAlert } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type {
  BoardIssueDto,
  ProjectBoardColumnConfigDto,
  ProjectBoardViewDto,
  ProjectSummaryDto,
  WorkspaceMemberDto,
  WorkspaceSummaryDto
} from "@wevlo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn
} from "@wevlo/ui-web";

import { AppShell } from "@/components/app-shell";
import { ProjectBoardSettingsEditor, boardAccentClasses } from "@/components/project-board-settings-editor";
import { ProjectSidebarNav } from "@/components/project-sidebar-nav";
import {
  getProjectHref,
  getWorkspaceHref,
  transitionIssue,
  updateProjectBoardConfig
} from "@/lib/issue-hub-data";

type ProjectBoardSurfaceProps = {
  initialBoard: ProjectBoardViewDto;
  initialCustomizeOpen?: boolean;
  project: ProjectSummaryDto;
  projects: ProjectSummaryDto[];
  shellViewer: {
    email?: string | null;
    name: string;
  };
  shellWorkspaces: Array<{
    name: string;
    slug: string;
  }>;
  workspace: WorkspaceSummaryDto;
  workspaceMembers: WorkspaceMemberDto[];
};

type BoardColumn = ProjectBoardViewDto["columns"][number];

const boardStateOrder: BoardIssueDto["state"][] = ["backlog", "todo", "in_progress", "done", "canceled"];

const nextStates: Record<BoardIssueDto["state"], BoardIssueDto["state"][]> = {
  backlog: boardStateOrder.filter((state) => state !== "backlog"),
  todo: boardStateOrder.filter((state) => state !== "todo"),
  in_progress: boardStateOrder.filter((state) => state !== "in_progress"),
  done: boardStateOrder.filter((state) => state !== "done"),
  canceled: boardStateOrder.filter((state) => state !== "canceled")
};

const tabLinkClassName = (active: boolean) =>
  cn(
    "inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "border-primary/50 bg-primary text-primary-foreground"
      : "border-border/70 bg-background/60 text-foreground hover:bg-secondary/70"
  );

const canManageBoard = (role: ProjectSummaryDto["currentUserRole"]) => role === "Owner" || role === "Maintainer";

const groupByState = (issues: BoardIssueDto[]) =>
  issues.reduce<Record<BoardIssueDto["state"], BoardIssueDto[]>>(
    (accumulator, issue) => {
      accumulator[issue.state].push(issue);
      return accumulator;
    },
    {
      backlog: [],
      todo: [],
      in_progress: [],
      done: [],
      canceled: []
    }
  );

const applyConfigToColumns = (
  currentColumns: BoardColumn[],
  configColumns: ProjectBoardColumnConfigDto[]
): BoardColumn[] => {
  const issuesByState = groupByState(currentColumns.flatMap((column) => column.issues));

  return configColumns
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((column) => ({
      ...column,
      issues: issuesByState[column.state] ?? []
    }));
};

const extractConfigColumns = (columns: BoardColumn[]): ProjectBoardColumnConfigDto[] =>
  columns.map((column, index) => ({
    state: column.state,
    label: column.label,
    accent: column.accent,
    order: index
  }));

const getAssigneeLabel = (issue: BoardIssueDto, memberNameById: Record<string, string>) =>
  issue.assigneeUserId ? memberNameById[issue.assigneeUserId] ?? issue.assigneeUserId : "Unassigned";

const getInitials = (label: string) => {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "NA";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

const findIssueLocation = (columns: BoardColumn[], issueId: string) => {
  for (const column of columns) {
    const issueIndex = column.issues.findIndex((issue) => issue.id === issueId);

    if (issueIndex >= 0) {
      const issue = column.issues[issueIndex];

      if (!issue) {
        return null;
      }

      return {
        columnState: column.state,
        issue,
        issueIndex
      };
    }
  }

  return null;
};

const moveIssueAcrossColumns = (
  columns: BoardColumn[],
  issueId: string,
  targetState: BoardIssueDto["state"],
  overIssueId?: string
): BoardColumn[] => {
  const sourceLocation = findIssueLocation(columns, issueId);

  if (!sourceLocation) {
    return columns;
  }

  const sourceColumnIndex = columns.findIndex((column) => column.state === sourceLocation.columnState);
  const targetColumnIndex = columns.findIndex((column) => column.state === targetState);

  if (sourceColumnIndex < 0 || targetColumnIndex < 0) {
    return columns;
  }

  const sourceColumn = columns[sourceColumnIndex];
  const targetColumn = columns[targetColumnIndex];

  if (!sourceColumn || !targetColumn) {
    return columns;
  }

  const nextColumns = columns.map((column) => ({
    ...column,
    issues: column.issues.slice()
  }));

  const sourceIssues = nextColumns[sourceColumnIndex]?.issues;

  if (!sourceIssues) {
    return columns;
  }

  const [removed] = sourceIssues.splice(sourceLocation.issueIndex, 1);

  if (!removed) {
    return columns;
  }

  const updatedIssue = sourceLocation.columnState === targetState ? removed : { ...removed, state: targetState };

  if (sourceLocation.columnState === targetState) {
    const reordered = nextColumns[sourceColumnIndex]?.issues;

    if (!reordered) {
      return columns;
    }

    const overIndex = overIssueId ? reordered.findIndex((issue) => issue.id === overIssueId) : reordered.length;
    const nextIndex = overIndex >= 0 ? overIndex : reordered.length;
    reordered.splice(nextIndex, 0, updatedIssue);
    return nextColumns;
  }

  const targetIssues = nextColumns[targetColumnIndex]?.issues;

  if (!targetIssues) {
    return columns;
  }

  const overIndex = overIssueId ? targetIssues.findIndex((issue) => issue.id === overIssueId) : targetIssues.length;
  const insertIndex = overIndex >= 0 ? overIndex : targetIssues.length;
  targetIssues.splice(insertIndex, 0, updatedIssue);

  return nextColumns;
};

function BoardColumnPanel({
  accent,
  children,
  count,
  label,
  state
}: {
  accent: BoardColumn["accent"];
  children: ReactNode;
  count: number;
  label: string;
  state: BoardColumn["state"];
}) {
  const { chip, dot, rail } = boardAccentClasses[accent];
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${state}`,
    data: {
      type: "column",
      state
    }
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[560px] w-[272px] shrink-0 flex-col rounded-[28px] border border-border/70 border-t-[3px] bg-card/80 p-3.5 shadow-sm xl:flex-1 xl:basis-0",
        rail,
        isOver && "ring-2 ring-primary/35"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", dot)} />
          <div className="text-sm font-semibold text-foreground">{label}</div>
        </div>
        <span className={cn("rounded-full border px-2 py-1 text-xs font-medium", chip)}>{count}</span>
      </div>
      <div className="mt-3 flex-1">{children}</div>
    </section>
  );
}

function SortableBoardIssueCard({
  assigneeLabel,
  issue,
  onNavigate,
  onTransition
}: {
  assigneeLabel: string;
  issue: BoardIssueDto;
  onNavigate: () => void;
  onTransition: (nextState: BoardIssueDto["state"]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: issue.id,
    data: {
      type: "issue",
      issueId: issue.id,
      state: issue.state
    }
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      className={cn(
        "group rounded-2xl border border-border/70 bg-background/95 p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-60 shadow-lg"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{issue.issueKey}</div>
          <button
            type="button"
            onClick={onNavigate}
            className="mt-1.5 text-left text-sm font-semibold leading-5 text-foreground transition-colors hover:text-primary"
          >
            {issue.title}
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-secondary/70 hover:text-foreground"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Issue actions</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onNavigate}>Open issue</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {nextStates[issue.state].length > 0 ? (
              nextStates[issue.state].map((state) => (
                <DropdownMenuItem key={state} onSelect={() => onTransition(state)}>
                  {state.replace("_", " ")}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No further transitions</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
        {issue.description.trim().length > 0 ? issue.description : "No description yet."}
      </p>
      <div className="mt-3 flex items-center justify-end gap-3">
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/35 px-1.5 py-1"
          title={assigneeLabel}
        >
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/12 text-[10px] font-semibold text-primary">
            {getInitials(assigneeLabel)}
          </span>
          <span className="hidden max-w-[96px] truncate text-[11px] text-muted-foreground sm:inline">{assigneeLabel}</span>
        </div>
      </div>
    </article>
  );
}

function BoardIssuePreviewCard({
  assigneeLabel,
  issue
}: {
  assigneeLabel: string;
  issue: BoardIssueDto;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-background/95 p-3 shadow-lg">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{issue.issueKey}</div>
      <div className="mt-1.5 text-sm font-semibold leading-5 text-foreground">{issue.title}</div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
        {issue.description.trim().length > 0 ? issue.description : "No description yet."}
      </p>
      <div className="mt-3 flex items-center justify-end">
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/35 px-1.5 py-1"
          title={assigneeLabel}
        >
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/12 text-[10px] font-semibold text-primary">
            {getInitials(assigneeLabel)}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ProjectBoardSurface({
  initialBoard,
  initialCustomizeOpen = false,
  project,
  projects,
  shellViewer,
  shellWorkspaces,
  workspace,
  workspaceMembers
}: ProjectBoardSurfaceProps) {
  const router = useRouter();
  const [columns, setColumns] = useState<BoardColumn[]>(initialBoard.columns);
  const [configColumns, setConfigColumns] = useState<ProjectBoardColumnConfigDto[]>(extractConfigColumns(initialBoard.columns));
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(initialCustomizeOpen);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  const canEditBoard = canManageBoard(project.currentUserRole);

  useEffect(() => {
    setColumns(initialBoard.columns);
    setConfigColumns(extractConfigColumns(initialBoard.columns));
  }, [initialBoard]);

  const memberNameById = useMemo(
    () =>
      Object.fromEntries(workspaceMembers.map((member) => [member.userId, member.user.name])),
    [workspaceMembers]
  );
  const activeIssue = useMemo(
    () => columns.flatMap((column) => column.issues).find((issue) => issue.id === activeIssueId) ?? null,
    [activeIssueId, columns]
  );
  const acceptedIssueCount = useMemo(
    () => columns.reduce((total, column) => total + column.issues.length, 0),
    [columns]
  );

  const closeCustomizeDialog = () => {
    setIsCustomizeOpen(false);

    if (initialCustomizeOpen) {
      router.replace(getProjectHref(workspace.slug, project.key, "board"));
    }
  };

  const handleTransition = async (
    issue: BoardIssueDto,
    nextState: BoardIssueDto["state"],
    nextColumnsOverride?: BoardColumn[]
  ) => {
    if (issue.state === nextState || !nextStates[issue.state].includes(nextState)) {
      return;
    }

    const previousColumns = columns;
    const nextColumns = nextColumnsOverride ?? moveIssueAcrossColumns(columns, issue.id, nextState);

    setColumns(nextColumns);
    setBusyIssueId(issue.id);
    setErrorMessage(null);

    try {
      const updatedIssue = await transitionIssue(workspace.slug, project.key, issue.issueKey, {
        state: nextState
      });
      setColumns((current) =>
        current.map((column) => ({
          ...column,
          issues: column.issues.map((candidate) =>
            candidate.id === issue.id
              ? {
                  ...candidate,
                  title: updatedIssue.title,
                  description: updatedIssue.description,
                  state: updatedIssue.state,
                  priority: updatedIssue.priority,
                  assigneeUserId: updatedIssue.assigneeUserId,
                  updatedAt: updatedIssue.updatedAt
                }
              : candidate
          )
        }))
      );
      router.refresh();
    } catch (error) {
      setColumns(previousColumns);
      setErrorMessage(error instanceof Error ? error.message : "Board move failed");
    } finally {
      setBusyIssueId(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveIssueId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveIssueId(null);
    const { active, over } = event;

    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const activeLocation = findIssueLocation(columns, activeId);

    if (!activeLocation) {
      return;
    }

    const overType = over.data.current?.type as "column" | "issue" | undefined;
    const targetState =
      overType === "column"
        ? (over.data.current?.state as BoardIssueDto["state"] | undefined)
        : (over.data.current?.state as BoardIssueDto["state"] | undefined);

    if (!targetState) {
      return;
    }

    if (targetState === activeLocation.issue.state) {
      const overIssueId = overType === "issue" ? String(over.data.current?.issueId) : undefined;
      if (!overIssueId || overIssueId === activeId) {
        return;
      }

      const currentColumnIndex = columns.findIndex((column) => column.state === targetState);

      if (currentColumnIndex < 0) {
        return;
      }

      const issueIds = columns[currentColumnIndex]?.issues.map((issue) => issue.id) ?? [];
      const oldIndex = issueIds.indexOf(activeId);
      const newIndex = issueIds.indexOf(overIssueId);

      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        return;
      }

      setColumns((current) =>
        current.map((column) =>
          column.state === targetState
            ? {
                ...column,
                issues: arrayMove(column.issues, oldIndex, newIndex)
              }
            : column
        )
      );
      return;
    }

    if (!nextStates[activeLocation.issue.state].includes(targetState)) {
      return;
    }

    const overIssueId = overType === "issue" ? String(over.data.current?.issueId) : undefined;
    const previewColumns = moveIssueAcrossColumns(columns, activeId, targetState, overIssueId);
    await handleTransition(activeLocation.issue, targetState, previewColumns);
  };

  const handleSaveBoardConfig = async () => {
    setIsSavingConfig(true);
    setConfigError(null);

    try {
      const savedConfig = await updateProjectBoardConfig(workspace.slug, project.key, {
        columns: configColumns
      });
      setConfigColumns(savedConfig.columns);
      setColumns((current) => applyConfigToColumns(current, savedConfig.columns));
      closeCustomizeDialog();
      router.refresh();
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : "Board settings update failed");
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <AppShell
      viewer={shellViewer}
      workspaces={shellWorkspaces}
      currentWorkspaceSlug={workspace.slug}
      title={`${project.key} · ${project.name}`}
      subtitle="Project board"
      newIssueHref={getProjectHref(workspace.slug, project.key, "new")}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: workspace.name, href: getWorkspaceHref(workspace.slug) },
        { label: project.key }
      ]}
      actions={
        <>
          <Link href={getProjectHref(workspace.slug, project.key, "triage")} className={tabLinkClassName(false)}>
            Triage
          </Link>
          {canEditBoard ? (
            <Button variant="outline" size="sm" onClick={() => setIsCustomizeOpen(true)}>
              <LayoutTemplate className="size-4" />
              Customize board
            </Button>
          ) : null}
        </>
      }
      tabs={
        <div className="flex flex-wrap gap-2">
          <Link href={getProjectHref(workspace.slug, project.key, "issues")} className={tabLinkClassName(false)}>
            Issues
          </Link>
          <Link href={getProjectHref(workspace.slug, project.key, "board")} className={tabLinkClassName(true)}>
            Board
          </Link>
          <Link href={getProjectHref(workspace.slug, project.key, "triage")} className={tabLinkClassName(false)}>
            Triage
          </Link>
        </div>
      }
      sidebar={<ProjectSidebarNav mode="board" project={project} projects={projects} workspace={workspace} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Rows3 className="size-4 text-primary" />
              Board only view
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Drag issues between columns to update state. Cards stay intentionally quiet: title, description, issue key, and assignee only.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleDot className="size-4" />
            {acceptedIssueCount} accepted issue{acceptedIssueCount === 1 ? "" : "s"}
          </div>
        </div>
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={(event) => void handleDragEnd(event)}>
          <div className="overflow-x-auto pb-4">
            <div className="flex min-h-[560px] gap-4">
              {columns.map((column) => (
                <BoardColumnPanel
                  key={column.state}
                  accent={column.accent}
                  count={column.issues.length}
                  label={column.label}
                  state={column.state}
                >
                  <SortableContext items={column.issues.map((issue) => issue.id)} strategy={verticalListSortingStrategy}>
                    <div className="grid gap-3">
                      {column.issues.length > 0 ? (
                        column.issues.map((issue) => (
                          <SortableBoardIssueCard
                            key={issue.id}
                            issue={issue}
                            assigneeLabel={getAssigneeLabel(issue, memberNameById)}
                            onNavigate={() => router.push(`/${workspace.slug}/${project.key}/issues/${issue.issueKey}`)}
                            onTransition={(nextState) => void handleTransition(issue, nextState)}
                          />
                        ))
                      ) : (
                        <div className="flex min-h-32 items-center rounded-2xl border border-dashed border-border/80 bg-background/55 px-4 py-5 text-sm leading-6 text-muted-foreground">
                          Drop an issue here or leave the lane empty when nothing belongs in {column.label}.
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </BoardColumnPanel>
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeIssue ? (
              <div className="w-[292px]">
                <BoardIssuePreviewCard
                  issue={activeIssue}
                  assigneeLabel={getAssigneeLabel(activeIssue, memberNameById)}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <Dialog open={isCustomizeOpen} onOpenChange={(open) => (open ? setIsCustomizeOpen(true) : closeCustomizeDialog())}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customize board</DialogTitle>
            <DialogDescription>
              Reorder columns and tune the labels or accents for the whole project. Workflow states stay the same, only the presentation changes.
            </DialogDescription>
          </DialogHeader>
          {canEditBoard ? (
            <>
              <ProjectBoardSettingsEditor columns={configColumns} onChange={setConfigColumns} disabled={isSavingConfig} />
              {configError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {configError}
                </div>
              ) : null}
              <DialogFooter>
                <Button variant="outline" onClick={closeCustomizeDialog} disabled={isSavingConfig}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSaveBoardConfig()} disabled={isSavingConfig}>
                  {isSavingConfig ? "Saving..." : "Save board"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4" />
                Board settings require project management access.
              </div>
              <p className="mt-2 leading-6 text-amber-900/80">
                Owners and maintainers can rename or reorder columns for everyone in the project.
              </p>
              <div className="mt-4">
                <Button variant="outline" onClick={closeCustomizeDialog}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {busyIssueId ? (
        <div className="pointer-events-none fixed bottom-4 right-4 rounded-full border border-border/70 bg-background/95 px-4 py-2 text-sm text-muted-foreground shadow-lg">
          <div className="flex items-center gap-2">
            <PanelTopOpen className="size-4 text-primary" />
            Updating board...
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
