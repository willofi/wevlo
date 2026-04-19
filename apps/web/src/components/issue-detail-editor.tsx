"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import type { IssueDetailDto, IssuePriority, IssueState, WorkspaceMemberDto } from "@wevlo/contracts";
import {
  Avatar,
  AvatarFallback,
  Button,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea
} from "@wevlo/ui-web";

import { createComment, transitionIssue, updateIssue } from "@/lib/issue-hub-data";
import type { UserDirectory } from "@/lib/user-directory";
import { getDirectoryUserLabel } from "@/lib/user-directory";

type IssueDetailEditorProps = {
  issue: IssueDetailDto;
  mode?: "drawer" | "page";
  onIssueUpdated: (issue: IssueDetailDto) => void;
  projectKey: string;
  userDirectory: UserDirectory;
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
};

const stateOptions: Array<{ label: string; value: IssueState }> = [
  { label: "Backlog", value: "backlog" },
  { label: "Todo", value: "todo" },
  { label: "In progress", value: "in_progress" },
  { label: "Done", value: "done" },
  { label: "Canceled", value: "canceled" }
];

const priorityOptions: Array<{ label: string; value: IssuePriority }> = [
  { label: "No priority", value: "none" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" }
];

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));

export function IssueDetailEditor({
  issue,
  mode = "drawer",
  onIssueUpdated,
  projectKey,
  userDirectory,
  workspaceMembers,
  workspaceSlug
}: IssueDetailEditorProps) {
  const [draftTitle, setDraftTitle] = useState(issue.title);
  const [draftDescription, setDraftDescription] = useState(issue.description);
  const [commentBody, setCommentBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraftTitle(issue.title);
    setDraftDescription(issue.description);
    setCommentBody("");
    setError(null);
  }, [issue.description, issue.id, issue.title]);

  const hasContentChanges = draftTitle !== issue.title || draftDescription !== issue.description;
  const contentClassName = mode === "page" ? "grid gap-8" : "grid gap-6";

  const perform = (action: () => Promise<IssueDetailDto>) => {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const updated = await action();
          onIssueUpdated(updated);
        } catch (actionError) {
          setError(actionError instanceof Error ? actionError.message : "Issue update failed.");
        }
      })();
    });
  };

  const handleStateChange = (value: string) => {
    const nextState = value as IssueState;

    if (nextState === issue.state) {
      return;
    }

    perform(() => transitionIssue(workspaceSlug, projectKey, issue.issueKey, { state: nextState }));
  };

  const handlePriorityChange = (value: string) => {
    const nextPriority = value as IssuePriority;

    if (nextPriority === issue.priority) {
      return;
    }

    perform(() => updateIssue(workspaceSlug, projectKey, issue.issueKey, { priority: nextPriority }));
  };

  const handleAssigneeChange = (value: string) => {
    const nextAssignee = value === "unassigned" ? null : value;

    if (nextAssignee === issue.assigneeUserId) {
      return;
    }

    perform(() =>
      updateIssue(workspaceSlug, projectKey, issue.issueKey, {
        assigneeUserId: nextAssignee
      })
    );
  };

  const handleSaveCore = () => {
    if (!hasContentChanges) {
      return;
    }

    perform(() =>
      updateIssue(workspaceSlug, projectKey, issue.issueKey, {
        description: draftDescription,
        title: draftTitle
      })
    );
  };

  const handleCreateComment = () => {
    if (commentBody.trim().length === 0) {
      return;
    }

    perform(async () => {
      const updated = await createComment(workspaceSlug, projectKey, issue.issueKey, {
        body: commentBody.trim()
      });
      setCommentBody("");
      return updated;
    });
  };

  const comments = useMemo(
    () =>
      [...issue.comments].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [issue.comments]
  );

  return (
    <ScrollArea className="h-full">
      <div className={contentClassName}>
        <section className="grid gap-4">
          <div className="grid gap-2">
            <div className="font-mono text-xs text-muted-foreground">{issue.issueKey}</div>
            <Input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="h-auto border-none bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Description</div>
            <Textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              className="min-h-[160px] border-border/70 bg-card/50"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!hasContentChanges || isPending} onClick={handleSaveCore}>
              Save changes
            </Button>
            {error ? <div className="text-sm text-destructive">{error}</div> : null}
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-border/70 bg-card/35 p-4">
          <div className="grid gap-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</div>
            <Select value={issue.state} onValueChange={handleStateChange}>
              <SelectTrigger disabled={isPending}>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {stateOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Priority</div>
            <Select value={issue.priority} onValueChange={handlePriorityChange}>
              <SelectTrigger disabled={isPending}>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Assignee</div>
            <Select value={issue.assigneeUserId ?? "unassigned"} onValueChange={handleAssigneeChange}>
              <SelectTrigger disabled={isPending}>
                <SelectValue placeholder="Assign issue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {workspaceMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>Reporter</span>
              <span className="flex min-w-0 items-center gap-2 text-foreground">
                <Avatar className="size-5 border border-border/60 bg-secondary/60">
                  <AvatarFallback className="bg-transparent text-[10px] font-semibold text-foreground">
                    {userDirectory[issue.reporterUserId]?.initials ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{getDirectoryUserLabel(userDirectory, issue.reporterUserId)}</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Created</span>
              <span className="text-foreground">{formatDateTime(issue.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Updated</span>
              <span className="text-foreground">{formatDateTime(issue.updatedAt)}</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-xl border border-border/70 bg-card/35 p-4">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Comments</div>
          <div className="grid gap-2">
            <Textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Add context, decisions, or updates."
              className="min-h-[112px] border-border/70 bg-card/50"
            />
            <div className="flex justify-end">
              <Button disabled={isPending || commentBody.trim().length === 0} onClick={handleCreateComment}>
                Add comment
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            {comments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No comments yet.</div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-border/60 bg-background/20 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                      <Avatar className="size-5 border border-border/60 bg-secondary/60">
                        <AvatarFallback className="bg-transparent text-[10px] font-semibold text-foreground">
                          {userDirectory[comment.authorUserId]?.initials ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{getDirectoryUserLabel(userDirectory, comment.authorUserId)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{comment.body}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
