"use client";

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { IssueDetailDto, IssueState } from "@wevlo/contracts";
import { Avatar, AvatarFallback, Badge, cn } from "@wevlo/ui-web";

import { buildProjectShellHref } from "@/lib/issue-hub-data";
import type { UserDirectory } from "@/lib/user-directory";
import { getDirectoryUserLabel } from "@/lib/user-directory";

type IssueBoardViewProps = {
  assigneeDirectory?: UserDirectory;
  currentIssueKey?: string;
  issues: IssueDetailDto[];
  onTransitionIssue: (issueKey: string, state: IssueState) => Promise<void> | void;
  projectKey: string;
  workspaceSlug: string;
};

const boardStates: IssueState[] = ["backlog", "todo", "in_progress", "done", "canceled"];

const boardLabels: Record<IssueState, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled"
};

function DraggableIssueCard({
  active,
  assigneeDirectory,
  issue,
  projectKey,
  workspaceSlug
}: {
  active: boolean;
  assigneeDirectory: UserDirectory;
  issue: IssueDetailDto;
  projectKey: string;
  workspaceSlug: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.issueKey,
    data: {
      issueKey: issue.issueKey,
      state: issue.state
    }
  });

  return (
    <Link
      href={buildProjectShellHref(workspaceSlug, projectKey, { issueKey: issue.issueKey, view: "board" })}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "block rounded-lg border border-border/80 bg-card/90 px-3 py-3 shadow-none transition-colors hover:bg-secondary/60",
        (active || isDragging) && "border-primary/50 bg-secondary/70 opacity-80"
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{issue.issueKey}</span>
        <Badge variant="outline" className="rounded-full border-border/70 bg-background/70 px-2 py-0 text-[10px]">
          {issue.priority === "none" ? "No priority" : issue.priority}
        </Badge>
      </div>
      <div className="mt-2 text-sm font-medium leading-5 text-foreground">{issue.title}</div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {issue.assigneeUserId ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-4 border border-border/60 bg-secondary/60">
              <AvatarFallback className="bg-transparent text-[9px] font-semibold text-foreground">
                {assigneeDirectory[issue.assigneeUserId]?.initials ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">
              {getDirectoryUserLabel(assigneeDirectory, issue.assigneeUserId)}
            </span>
          </span>
        ) : (
          <span>{getDirectoryUserLabel(assigneeDirectory, issue.assigneeUserId)}</span>
        )}
        <span>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "short" }).format(new Date(issue.updatedAt))}</span>
      </div>
    </Link>
  );
}

function BoardColumn({
  activeIssueKey,
  assigneeDirectory,
  currentIssueKey,
  issues,
  projectKey,
  state,
  workspaceSlug
}: {
  activeIssueKey: string | undefined;
  assigneeDirectory: UserDirectory;
  currentIssueKey: string | undefined;
  issues: IssueDetailDto[];
  projectKey: string;
  state: IssueState;
  workspaceSlug: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: state
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-[420px] flex-col rounded-xl border border-border/80 bg-card/35",
        isOver && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between border-b border-border/80 px-3 py-3">
        <div className="text-sm font-medium text-foreground">{boardLabels[state]}</div>
        <div className="text-xs text-muted-foreground">{issues.length}</div>
      </div>
      <div className="grid content-start gap-2 p-2">
        {issues.map((issue) => (
          <DraggableIssueCard
            key={issue.id}
            active={issue.issueKey === activeIssueKey || issue.issueKey === currentIssueKey}
            assigneeDirectory={assigneeDirectory}
            issue={issue}
            projectKey={projectKey}
            workspaceSlug={workspaceSlug}
          />
        ))}
      </div>
    </section>
  );
}

export function IssueBoardView({
  assigneeDirectory = {},
  currentIssueKey,
  issues,
  onTransitionIssue,
  projectKey,
  workspaceSlug
}: IssueBoardViewProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeIssueKey, setActiveIssueKey] = useState<string | null>(null);
  const issuesByState = useMemo(
    () =>
      Object.fromEntries(
        boardStates.map((state) => [
          state,
          issues
            .filter((issue) => issue.state === state)
            .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
        ])
      ) as Record<IssueState, IssueDetailDto[]>,
    [issues]
  );
  const activeIssue = activeIssueKey ? issues.find((issue) => issue.issueKey === activeIssueKey) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    if (typeof event.active.id === "string") {
      setActiveIssueKey(event.active.id);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveIssueKey(null);

    if (!event.over || typeof event.active.id !== "string" || typeof event.over.id !== "string") {
      return;
    }

    const nextState = event.over.id as IssueState;
    const issue = issues.find((candidate) => candidate.issueKey === event.active.id);

    if (!issue || issue.state === nextState) {
      return;
    }

    await onTransitionIssue(issue.issueKey, nextState);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={(event) => void handleDragEnd(event)} onDragStart={handleDragStart}>
      <div className="grid gap-4 xl:grid-cols-5">
        {boardStates.map((state) => (
          <BoardColumn
            key={state}
            activeIssueKey={activeIssueKey ?? undefined}
            assigneeDirectory={assigneeDirectory}
            currentIssueKey={currentIssueKey}
            issues={issuesByState[state]}
            projectKey={projectKey}
            state={state}
            workspaceSlug={workspaceSlug}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <div className="w-[260px] rounded-lg border border-primary/50 bg-card px-3 py-3 shadow-2xl shadow-black/30">
            <div className="font-mono text-[11px] text-muted-foreground">{activeIssue.issueKey}</div>
            <div className="mt-2 text-sm font-medium text-foreground">{activeIssue.title}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
