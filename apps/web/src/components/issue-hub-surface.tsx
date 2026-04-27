"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type {
  IssueDetailDto,
  IssueListItemDto,
  ProjectSummaryDto,
  UpdateIssueRequest,
  WorkspaceMemberDto,
  WorkspaceSummaryDto
} from "@wevlo/contracts";
import { tokens } from "@wevlo/ui-core";
import { Button, Input, Textarea, cn, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, PriorityChip, StatusChip, TriageChip } from "@wevlo/ui-web";

import { AppShell } from "@/components/app-shell";
import { IssueListTable } from "@/components/issue-list-table";
import { ProjectSidebarNav } from "@/components/project-sidebar-nav";
import {
  buildProjectKeyCandidatesClient,
  buildWorkspaceSlugCandidatesClient,
  normalizeProjectKeyClient,
  normalizeWorkspaceSlugClient
} from "@/lib/client-slug";
import {
  acceptTriage,
  createComment as persistComment,
  createIssue as persistIssueCreate,
  createProject,
  createWorkspace,
  getIssueHref,
  getProjectAccessHref,
  getProjectHref,
  getProjectIntegrationsHref,
  getMyIssuesHref,
  getWorkspaceAccessHref,
  getWorkspaceIntegrationsHref,
  getWorkspaceMembersHref,
  getUserLabel,
  getWorkspaceHref,
  transitionIssue,
  updateIssue as persistIssueUpdate,
  waitForProjectRead,
  waitForWorkspaceRead
} from "@/lib/issue-hub-data";

export type IssueHubMode = "bootstrap" | "workspace" | "issues" | "create" | "issue" | "board" | "triage";

type ShellProps = {
  shellViewer: {
    email?: string | null;
    name: string;
  };
  shellWorkspaces: Array<{
    name: string;
    slug: string;
  }>;
};

type BootstrapProps = ShellProps & {
  mode: "bootstrap";
  workspaces: WorkspaceSummaryDto[];
  featuredWorkspaceSlug: string;
  projectsByWorkspace: Record<string, ProjectSummaryDto[]>;
};

type WorkspaceProps = ShellProps & {
  mode: "workspace";
  workspace: WorkspaceSummaryDto;
  projects: ProjectSummaryDto[];
  recentIssues: IssueDetailDto[];
};

type ProjectProps = ShellProps & {
  mode: Exclude<IssueHubMode, "bootstrap" | "workspace">;
  currentScope?: "all" | "assigned" | "created";
  workspace: WorkspaceSummaryDto;
  project: ProjectSummaryDto;
  projects: ProjectSummaryDto[];
  issues: IssueDetailDto[];
  issue?: IssueDetailDto;
  workspaceMembers?: WorkspaceMemberDto[];
};

export type IssueHubSurfaceProps = BootstrapProps | WorkspaceProps | ProjectProps;

const stateOrder: IssueListItemDto["state"][] = ["backlog", "todo", "in_progress", "done", "canceled"];

const surfaceColor = {
  background: "hsl(var(--card))",
  border: "hsl(var(--border))",
  foreground: "hsl(var(--foreground))",
  input: "hsl(var(--background))",
  muted: "hsl(var(--muted-foreground))",
  primary: "hsl(var(--primary))",
  primaryForeground: "hsl(var(--primary-foreground))",
  primarySoft: "hsl(var(--primary) / 0.10)",
  secondary: "hsl(var(--secondary) / 0.55)",
  subtle: "hsl(var(--muted) / 0.55)"
} as const;

const cardStyle = {
  background: surfaceColor.background,
  border: `1px solid ${surfaceColor.border}`,
  borderRadius: 18,
  padding: tokens.spacing.lg
};

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: tokens.spacing.md,
  marginBottom: tokens.spacing.md
} as const;

const smallMutedStyle = {
  color: surfaceColor.muted,
  fontSize: 13,
  lineHeight: 1.5
} as const;

const buttonBaseStyle = {
  borderRadius: 12,
  border: `1px solid ${surfaceColor.border}`,
  fontSize: 13,
  fontWeight: 600,
  padding: "10px 14px",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  lineHeight: 1.2
} as const;

const primaryButtonStyle = {
  ...buttonBaseStyle,
  background: surfaceColor.primary,
  borderColor: surfaceColor.primary,
  color: surfaceColor.primaryForeground
} as const;

const secondaryButtonStyle = {
  ...buttonBaseStyle,
  background: surfaceColor.input,
  color: surfaceColor.foreground
} as const;

const inputStyle = {
  width: "100%",
  borderRadius: 12,
  border: `1px solid ${surfaceColor.border}`,
  background: surfaceColor.input,
  color: surfaceColor.foreground,
  padding: "10px 12px",
  fontSize: 14,
  boxSizing: "border-box",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)"
} as const;

const selectStyle = {
  ...inputStyle,
  minHeight: 42
} as const;

const textareaStyle = {
  ...inputStyle,
  minHeight: 110,
  resize: "vertical"
} as const;

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

const formatTimestamp = (value: string) => {
  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(parsed));
};

const linkButtonStyle = {
  ...secondaryButtonStyle,
  borderColor: surfaceColor.border,
  background: surfaceColor.secondary
} as const;

const stackStyle = {
  display: "grid",
  gap: tokens.spacing.lg
} as const;

const splitGridStyle = {
  display: "grid",
  gap: tokens.spacing.lg,
  gridTemplateColumns: "minmax(0, 1.7fr) minmax(300px, 0.9fr)"
} as const;

const threeColumnBoardStyle = {
  display: "grid",
  gap: tokens.spacing.md,
  gridTemplateColumns: "repeat(5, minmax(200px, 1fr))"
} as const;

const workspaceCardGridStyle = {
  display: "grid",
  gap: tokens.spacing.md,
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"
} as const;

const formatCount = (count: number): string => `${count.toLocaleString()} item${count === 1 ? "" : "s"}`;

const stateLabel = (state: IssueListItemDto["state"]): string => {
  switch (state) {
    case "backlog":
      return "Backlog";
    case "todo":
      return "Todo";
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
    case "canceled":
      return "Canceled";
  }
};

const nextStates: Record<IssueListItemDto["state"], IssueListItemDto["state"][]> = {
  backlog: stateOrder.filter((state) => state !== "backlog"),
  todo: stateOrder.filter((state) => state !== "todo"),
  in_progress: stateOrder.filter((state) => state !== "in_progress"),
  done: stateOrder.filter((state) => state !== "done"),
  canceled: stateOrder.filter((state) => state !== "canceled")
};

const priorityWeight: Record<IssueListItemDto["priority"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

const issuePriorityOptions: IssueListItemDto["priority"][] = ["none", "low", "medium", "high", "urgent"];

const priorityLabel: Record<IssueListItemDto["priority"], string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent"
};

const issueSourceLabel = (issue: IssueListItemDto): string => {
  const source = issue.sourceLinks[0];

  if (!source) {
    return "native";
  }

  return source.provider === "native" ? "native" : `${source.provider}:${source.externalId}`;
};

const contentBoxStyle = {
  display: "grid",
  gap: tokens.spacing.md
} as const;

const emptyStateStyle = {
  border: `1px dashed ${surfaceColor.border}`,
  borderRadius: 16,
  padding: tokens.spacing.lg,
  color: surfaceColor.muted,
  background: surfaceColor.subtle
} as const;

const tabLinkClassName = (active: boolean) =>
  cn(
    "inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "border-primary/50 bg-primary text-primary-foreground"
      : "border-border/70 bg-background/60 text-foreground hover:bg-secondary/70"
  );

function SidebarGroup({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: surfaceColor.muted }}>
        {title}
      </div>
      <div style={{ marginTop: 6, display: "grid", gap: 4 }}>{children}</div>
    </section>
  );
}

function SidebarLink({
  href,
  label,
  active,
  meta
}: {
  href: string;
  label: string;
  active?: boolean;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-secondary/60"
      )}
    >
      <span>{label}</span>
      {meta ? <span style={{ color: surfaceColor.muted, fontSize: 10 }}>{meta}</span> : null}
    </Link>
  );
}

function SidebarActionButton({
  label,
  onClick
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/60"
    >
      {label}
    </button>
  );
}

function Card({
  title,
  subtitle,
  children,
  actions
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section style={cardStyle}>
      {(title || subtitle || actions) ? (
        <div style={sectionHeaderStyle}>
          <div>
            {title ? <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2> : null}
            {subtitle ? <p style={{ margin: "6px 0 0", ...smallMutedStyle }}>{subtitle}</p> : null}
          </div>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function IssueCard({
  issue,
  href,
  active,
  onMove,
  compact
}: {
  issue: IssueListItemDto;
  href: string;
  active?: boolean;
  onMove?: (nextState: IssueListItemDto["state"]) => void;
  compact?: boolean;
}) {
  return (
    <article
      style={{
        ...cardStyle,
        padding: compact ? tokens.spacing.md : tokens.spacing.lg,
        borderColor: active ? surfaceColor.primary : surfaceColor.border,
        background: active ? surfaceColor.primarySoft : surfaceColor.background
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: compact ? 8 : 10 }}>
            <StatusChip status={issue.state} />
            <PriorityChip priority={issue.priority} />
            {compact ? null : <TriageChip status={issue.triageStatus} />}
          </div>
          <Link href={href} style={{ color: surfaceColor.foreground, textDecoration: "none" }}>
            <h3 style={{ margin: 0, fontSize: compact ? 15 : 16, lineHeight: 1.4 }}>{issue.title}</h3>
          </Link>
          {compact ? (
            <p style={{ ...smallMutedStyle, margin: "8px 0 0" }}>
              {issue.issueKey} · Assignee {getUserLabel(issue.assigneeUserId)}
            </p>
          ) : (
            <p style={{ ...smallMutedStyle, margin: "8px 0 0" }}>
              {issue.issueKey} · Reporter {getUserLabel(issue.reporterUserId)} · Assignee {getUserLabel(issue.assigneeUserId)}
            </p>
          )}
        </div>
        {compact ? null : <span style={{ color: surfaceColor.muted, fontSize: 12 }}>{issueSourceLabel(issue)}</span>}
      </div>
      {onMove ? (
        <div style={{ marginTop: tokens.spacing.md, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {nextStates[issue.state].map((nextState) => (
            <button
              key={nextState}
              type="button"
              onClick={() => onMove(nextState)}
              style={secondaryButtonStyle}
            >
              Move to {stateLabel(nextState)}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CommentThread({
  comments
}: {
  comments: IssueDetailDto["comments"];
}) {
  return (
    <div className="grid gap-5">
      {comments.length > 0 ? (
        comments.map((comment, index) => {
          const authorLabel = getUserLabel(comment.authorUserId);
          const initials =
            authorLabel
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? "")
              .join("") || "NA";

          return (
            <article
              key={comment.id}
              className={cn(
                "grid gap-2 pl-4",
                index === comments.length - 1 ? "border-l border-transparent" : "border-l border-border/70"
              )}
            >
              <div className="flex gap-3">
                <div className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">{authorLabel}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{comment.body}</p>
                </div>
              </div>
            </article>
          );
        })
      ) : (
        <div className="rounded-2xl border border-dashed border-border/70 px-5 py-8 text-center text-sm leading-6 text-muted-foreground">
          No comments yet. Open reply only when you need to add a real update.
        </div>
      )}
    </div>
  );
}

function IssueEditDialog({
  issue,
  open,
  onOpenChange,
  onSaved,
  projectKey,
  workspaceSlug
}: {
  issue: IssueDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (issue: IssueDetailDto) => void;
  projectKey: string;
  workspaceSlug: string;
}) {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastIssueKeyRef = useRef(issue.issueKey);

  useEffect(() => {
    if (lastIssueKeyRef.current !== issue.issueKey) {
      setStatusMessage(null);
      setErrorMessage(null);
      lastIssueKeyRef.current = issue.issueKey;
    }

    setTitle(issue.title);
    setDescription(issue.description);
  }, [issue.description, issue.issueKey, issue.title]);

  const hasChanges =
    title.trim() !== issue.title ||
    description.trim() !== issue.description;

  const handleReset = () => {
    setTitle(issue.title);
    setDescription(issue.description);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    const payload: UpdateIssueRequest = {};
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!hasChanges) {
      setStatusMessage("Nothing changed yet.");
      return;
    }

    if (trimmedTitle.length === 0) {
      setErrorMessage("Title is required.");
      return;
    }

    if (trimmedTitle !== issue.title) {
      payload.title = trimmedTitle;
    }

    if (trimmedDescription !== issue.description) {
      payload.description = trimmedDescription;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setStatusMessage(null);
      const updated = await persistIssueUpdate(workspaceSlug, projectKey, issue.issueKey, payload);
      onSaved(updated);
      setStatusMessage(`Saved ${updated.issueKey}.`);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Issue update failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,44rem)]">
        <DialogHeader>
          <DialogTitle>Edit issue</DialogTitle>
          <DialogDescription>Update the issue body only when title or description needs a deliberate edit.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-muted-foreground">Title</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-muted-foreground">Description</span>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-36" />
          </label>
          {statusMessage ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{statusMessage}</div>
          ) : null}
          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleReset} disabled={isSaving}>
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: surfaceColor.muted }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>{value}</div>
      {detail ? <div style={{ marginTop: 6, ...smallMutedStyle }}>{detail}</div> : null}
    </div>
  );
}

function IssueInspector({
  issue,
  onEdit,
  onSaved,
  onTransition,
  projectKey,
  workspaceMembers,
  workspaceSlug
}: {
  issue: IssueDetailDto;
  onEdit: () => void;
  onSaved: (issue: IssueDetailDto) => void;
  onTransition: (issueKey: string, nextState: IssueDetailDto["state"]) => void;
  projectKey: string;
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
}) {
  const [priority, setPriority] = useState(issue.priority);
  const [assigneeUserId, setAssigneeUserId] = useState(issue.assigneeUserId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setPriority(issue.priority);
    setAssigneeUserId(issue.assigneeUserId ?? "");
    setErrorMessage(null);
    setStatusMessage(null);
  }, [issue.assigneeUserId, issue.issueKey, issue.priority]);

  const assigneeOptions = useMemo(() => {
    const options = workspaceMembers.map((member) => ({
      label: `${member.user.name} · ${member.role}`,
      userId: member.userId
    }));

    if (issue.assigneeUserId && !options.some((option) => option.userId === issue.assigneeUserId)) {
      options.unshift({
        label: `${getUserLabel(issue.assigneeUserId)} · current assignee`,
        userId: issue.assigneeUserId
      });
    }

    return options;
  }, [issue.assigneeUserId, workspaceMembers]);

  const hasMetaChanges = priority !== issue.priority || (assigneeUserId || null) !== issue.assigneeUserId;

  const handleSaveMeta = async () => {
    if (!hasMetaChanges) {
      setStatusMessage("Metadata is already up to date.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setStatusMessage(null);
      const updated = await persistIssueUpdate(workspaceSlug, projectKey, issue.issueKey, {
        priority,
        assigneeUserId: assigneeUserId.length > 0 ? assigneeUserId : null
      });
      onSaved(updated);
      setStatusMessage("Inspector changes saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Issue metadata update failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="grid gap-4 xl:sticky xl:top-4 xl:self-start">
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">Details</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep state, assignee, and priority on the side so the main pane stays focused on reading.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit content
          </Button>
        </div>
        <div className="mt-5 grid gap-5">
          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</span>
            <div className="flex flex-wrap gap-2">
              {stateOrder.map((state) => (
                <Button
                  key={state}
                  type="button"
                  size="sm"
                  variant={state === issue.state ? "default" : "outline"}
                  onClick={() => onTransition(issue.issueKey, state)}
                  disabled={state === issue.state}
                >
                  {stateLabel(state)}
                </Button>
              ))}
            </div>
          </div>
          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Assignee</span>
            <select value={assigneeUserId} onChange={(event) => setAssigneeUserId(event.target.value)} className={selectClassName}>
              <option value="">Unassigned</option>
              {assigneeOptions.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as IssueListItemDto["priority"])} className={selectClassName}>
              {issuePriorityOptions.map((option) => (
                <option key={option} value={option}>
                  {priorityLabel[option]}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={handleSaveMeta} disabled={isSaving || !hasMetaChanges}>
            {isSaving ? "Saving..." : "Save metadata"}
          </Button>
          {statusMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{statusMessage}</div> : null}
          {errorMessage ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div> : null}
        </div>
      </div>
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Project</span>
            <span className="text-sm font-semibold text-foreground">{projectKey}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Reporter</span>
            <span className="max-w-[14rem] text-right text-sm font-semibold text-foreground">{getUserLabel(issue.reporterUserId)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Assignee</span>
            <span className="max-w-[14rem] text-right text-sm font-semibold text-foreground">{getUserLabel(issue.assigneeUserId)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Source</span>
            <span className="text-sm font-semibold text-foreground">{issueSourceLabel(issue)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Updated</span>
            <span className="text-sm font-semibold text-foreground">{formatTimestamp(issue.updatedAt)}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function IssueHubProjectPage({
  workspace,
  project,
  initialIssues,
  currentScope,
  mode,
  issue,
  workspaceMembers
}: {
  workspace: WorkspaceSummaryDto;
  project: ProjectSummaryDto;
  initialIssues: IssueDetailDto[];
  currentScope: "all" | "assigned" | "created";
  mode: Exclude<IssueHubMode, "bootstrap" | "workspace">;
  issue: IssueDetailDto | undefined;
  workspaceMembers: WorkspaceMemberDto[];
}) {
  const router = useRouter();
  const [issues, setIssues] = useState(initialIssues);
  const [search, setSearch] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDescription, setNewIssueDescription] = useState("");
  const [newIssuePriority, setNewIssuePriority] = useState<IssueListItemDto["priority"]>("medium");
  const [createdIssue, setCreatedIssue] = useState<IssueDetailDto | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCommentComposerOpen, setIsCommentComposerOpen] = useState(false);

  const activeIssue = issue ? issues.find((candidate) => candidate.issueKey === issue.issueKey) ?? issue : null;
  const boardColumns = stateOrder.map((state) => ({
    state,
    issues: issues
      .filter((candidate) => candidate.state === state)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }));
  const triageQueue = issues
    .filter((candidate) => candidate.triageStatus === "pending")
    .sort((left, right) => priorityWeight[right.priority] - priorityWeight[left.priority] || right.updatedAt.localeCompare(left.updatedAt));

  const filteredIssues = issues.filter((candidate) => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return (
      candidate.issueKey.toLowerCase().includes(needle) ||
      candidate.title.toLowerCase().includes(needle) ||
      getUserLabel(candidate.reporterUserId).toLowerCase().includes(needle) ||
      getUserLabel(candidate.assigneeUserId).toLowerCase().includes(needle)
    );
  });

  const mergeIssue = (updatedIssue: IssueDetailDto) => {
    setIssues((current) =>
      current.some((candidate) => candidate.issueKey === updatedIssue.issueKey)
        ? current.map((candidate) => (candidate.issueKey === updatedIssue.issueKey ? updatedIssue : candidate))
        : [updatedIssue, ...current]
    );
  };

  const handleIssueUpdated = (updatedIssue: IssueDetailDto) => {
    mergeIssue(updatedIssue);
    router.refresh();
  };

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const created = await persistIssueCreate(workspace.slug, project.key, {
        description: newIssueDescription.trim(),
        title: newIssueTitle.trim()
      });
      const persisted =
        newIssuePriority !== "none"
          ? await persistIssueUpdate(workspace.slug, project.key, created.issueKey, {
              priority: newIssuePriority
            })
          : created;

      mergeIssue(persisted);
      setCreatedIssue(persisted);
      setNewIssueTitle("");
      setNewIssueDescription("");
      setNewIssuePriority("medium");
      router.push(getIssueHref(workspace.slug, project.key, persisted.issueKey));
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Issue creation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransition = async (issueKey: string, nextState: IssueDetailDto["state"]) => {
    setErrorMessage(null);

    try {
      const updated = await transitionIssue(workspace.slug, project.key, issueKey, {
        state: nextState
      });
      mergeIssue(updated);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Issue transition failed");
    }
  };

  const handleComment = async () => {
    if (!activeIssue || !commentDraft.trim()) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const updated = await persistComment(workspace.slug, project.key, activeIssue.issueKey, {
        body: commentDraft.trim()
      });
      mergeIssue(updated);
      setCommentDraft("");
      setIsCommentComposerOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Comment failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptTriage = async (issueKey: string) => {
    setErrorMessage(null);

    try {
      const updated = await acceptTriage(workspace.slug, project.key, issueKey);
      mergeIssue(updated);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Triage acceptance failed");
    }
  };

  let content: ReactNode = null;

  if (mode === "issues") {
    content = (
      <div style={splitGridStyle}>
        <div style={{ display: "grid", gap: tokens.spacing.md }}>
          <Card
            title={currentScope === "assigned" ? "Assigned to me" : currentScope === "created" ? "Created by me" : "Project issues"}
            subtitle="A denser list so you can scan status, assignee, and recency without opening every card."
            actions={
              <>
                <input
                  aria-label="Search issues"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search issues"
                  style={{ ...inputStyle, width: 260 }}
                />
                <Link href={getProjectHref(workspace.slug, project.key, "new")} style={primaryButtonStyle}>
                  New issue
                </Link>
              </>
            }
          >
            <IssueListTable
              issues={filteredIssues}
              projectKeyById={{ [project.id]: project.key }}
              workspaceSlug={workspace.slug}
            />
          </Card>
        </div>
        <div style={{ display: "grid", gap: tokens.spacing.md }}>
          <MetricCard label="Open issues" value={formatCount(issues.filter((candidate) => candidate.state !== "done").length)} detail="Current project backlog and active work." />
          <MetricCard label="Pending triage" value={formatCount(triageQueue.length)} detail="Intake waiting for a decision." />
          <Card title="Quick create" subtitle="Capture a new issue without leaving the project page.">
            <div style={{ display: "grid", gap: tokens.spacing.md }}>
              <input
                value={newIssueTitle}
                onChange={(event) => setNewIssueTitle(event.target.value)}
                placeholder="Issue title"
                style={inputStyle}
              />
              <textarea
                value={newIssueDescription}
                onChange={(event) => setNewIssueDescription(event.target.value)}
                placeholder="Issue description"
                style={textareaStyle}
              />
              <button type="button" onClick={handleCreateIssue} style={primaryButtonStyle} disabled={isSubmitting}>
                Create issue
              </button>
            </div>
            {createdIssue ? (
              <div style={{ marginTop: tokens.spacing.md, ...emptyStateStyle }}>
                Created {createdIssue.issueKey}. Redirecting to detail view.
              </div>
            ) : null}
            {errorMessage ? <div style={{ marginTop: tokens.spacing.md, ...emptyStateStyle }}>{errorMessage}</div> : null}
          </Card>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    content = (
      <div style={splitGridStyle}>
        <Card
          title="New issue"
          subtitle="Create a persisted issue inside the current project."
          actions={
            <Link href={getProjectHref(workspace.slug, project.key, "issues")} style={linkButtonStyle}>
              Back to issues
            </Link>
          }
        >
          <div style={{ display: "grid", gap: tokens.spacing.md }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, color: surfaceColor.muted }}>Title</span>
              <input
                value={newIssueTitle}
                onChange={(event) => setNewIssueTitle(event.target.value)}
                placeholder="Workspace bootstrap should land on the active project"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, color: surfaceColor.muted }}>Description</span>
              <textarea
                value={newIssueDescription}
                onChange={(event) => setNewIssueDescription(event.target.value)}
                placeholder="Describe the issue, expected behavior, and acceptance notes."
                style={textareaStyle}
              />
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, color: surfaceColor.muted }}>Priority</span>
              <select value={newIssuePriority} onChange={(event) => setNewIssuePriority(event.target.value as IssueListItemDto["priority"])} style={selectStyle}>
                <option value="none">No priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <button type="button" onClick={handleCreateIssue} style={primaryButtonStyle} disabled={isSubmitting}>
              Create issue
            </button>
          </div>
        </Card>
        <Card title="What ships next" subtitle="This screen is now wired to the issue creation API.">
          <ul style={{ margin: 0, paddingLeft: 18, ...smallMutedStyle }}>
            <li>Create the issue inside the current workspace and project.</li>
            <li>Route directly to the issue detail page after save.</li>
            <li>Use follow-up patch calls for later metadata changes.</li>
          </ul>
          {createdIssue ? (
            <div style={{ marginTop: tokens.spacing.md, ...emptyStateStyle }}>
              Created issue: {createdIssue.issueKey}
            </div>
          ) : null}
          {errorMessage ? <div style={{ marginTop: tokens.spacing.md, ...emptyStateStyle }}>{errorMessage}</div> : null}
        </Card>
      </div>
    );
  }

  if (mode === "issue" && activeIssue) {
    content = (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <section className="grid gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{activeIssue.issueKey}</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{activeIssue.title}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
                  <span>Reporter {getUserLabel(activeIssue.reporterUserId)}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-border sm:inline-flex" />
                  <span>Updated {formatTimestamp(activeIssue.updatedAt)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={getProjectHref(workspace.slug, project.key, "issues")}>Back to issues</Link>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                  Edit issue
                </Button>
                <Button type="button" size="sm" onClick={() => setIsCommentComposerOpen((current) => !current)}>
                  {isCommentComposerOpen ? "Hide reply" : "Reply"}
                </Button>
              </div>
            </div>
            <div className="border-t border-border/70 pt-6">
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Description</div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                {activeIssue.description.trim().length > 0 ? activeIssue.description : "No description yet. Open edit only when the issue body needs actual context or acceptance notes."}
              </div>
            </div>
          </section>
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}
          <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Discussion</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Comments stay in a compact timeline, and the composer only opens when needed.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {activeIssue.comments.length} comment{activeIssue.comments.length === 1 ? "" : "s"}
              </div>
            </div>
            {isCommentComposerOpen ? (
              <div className="mt-5 rounded-2xl border border-border/70 bg-background/55 p-4">
                <div className="grid gap-3">
                  <Textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Leave a concise update, decision, or question."
                    className="min-h-28"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCommentComposerOpen(false)} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={() => void handleComment()} disabled={isSubmitting || commentDraft.trim().length === 0}>
                      {isSubmitting ? "Posting..." : "Post comment"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-6">
              <CommentThread comments={activeIssue.comments} />
            </div>
          </section>
        </div>
        <IssueInspector
          issue={activeIssue}
          onEdit={() => setIsEditDialogOpen(true)}
          onSaved={handleIssueUpdated}
          onTransition={handleTransition}
          projectKey={project.key}
          workspaceMembers={workspaceMembers}
          workspaceSlug={workspace.slug}
        />
        <IssueEditDialog
          issue={activeIssue}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSaved={handleIssueUpdated}
          projectKey={project.key}
          workspaceSlug={workspace.slug}
        />
      </div>
    );
  }

  if (mode === "board") {
    content = (
      <div style={threeColumnBoardStyle}>
        {boardColumns.map((column) => (
          <Card key={column.state} title={stateLabel(column.state)} subtitle={formatCount(column.issues.length)}>
            <div style={{ display: "grid", gap: tokens.spacing.md }}>
              {column.issues.map((candidate) => (
                <IssueCard
                  key={candidate.id}
                  issue={candidate}
                  href={getIssueHref(workspace.slug, project.key, candidate.issueKey)}
                  compact
                  onMove={(nextState) => handleTransition(candidate.issueKey, nextState)}
                />
              ))}
              {column.issues.length === 0 ? <div style={emptyStateStyle}>No issues in this lane.</div> : null}
            </div>
          </Card>
        ))}
        {errorMessage ? <div style={{ ...emptyStateStyle, gridColumn: "1 / -1" }}>{errorMessage}</div> : null}
      </div>
    );
  }

  if (mode === "triage") {
    content = (
      <div style={splitGridStyle}>
        <div style={{ display: "grid", gap: tokens.spacing.md }}>
          <Card title="Pending triage" subtitle="Accept or keep items pending before they reach the team backlog.">
            <div style={{ display: "grid", gap: tokens.spacing.md }}>
              {triageQueue.map((candidate) => (
                <article key={candidate.id} style={{ ...cardStyle, padding: tokens.spacing.md }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                        <PriorityChip priority={candidate.priority} />
                        <TriageChip status={candidate.triageStatus} />
                        <StatusChip status={candidate.state} />
                      </div>
                      <Link href={getIssueHref(workspace.slug, project.key, candidate.issueKey)} style={{ color: surfaceColor.foreground, textDecoration: "none" }}>
                        <strong style={{ fontSize: 16 }}>{candidate.issueKey}</strong>
                        <div style={{ marginTop: 6 }}>{candidate.title}</div>
                      </Link>
                      <div style={{ marginTop: 8, ...smallMutedStyle }}>
                        Reporter {getUserLabel(candidate.reporterUserId)} · Assignee {getUserLabel(candidate.assigneeUserId)}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <button type="button" onClick={() => handleAcceptTriage(candidate.issueKey)} style={primaryButtonStyle}>
                        Accept
                      </button>
                      <Link href={getIssueHref(workspace.slug, project.key, candidate.issueKey)} style={secondaryButtonStyle}>
                        Review issue
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
              {triageQueue.length === 0 ? <div style={emptyStateStyle}>No pending issues right now.</div> : null}
            </div>
          </Card>
        </div>
        <div style={{ display: "grid", gap: tokens.spacing.md }}>
          <MetricCard label="Accepted" value={formatCount(issues.filter((candidate) => candidate.triageStatus === "accepted").length)} detail="Items already cleared for planning." />
          <MetricCard label="Still pending" value={formatCount(triageQueue.length)} detail="Use this queue to make the intake decision explicit." />
          <Card title="Triage notes" subtitle="Accepted items persist through the API and leave the triage queue.">
            <ul style={{ margin: 0, paddingLeft: 18, ...smallMutedStyle }}>
              <li>Accepted items re-enter the planning flow automatically.</li>
              <li>Review keeps the issue detail route one click away.</li>
              <li>Priority and assignee triage edits can layer onto the same endpoint family.</li>
            </ul>
          </Card>
          {errorMessage ? <div style={emptyStateStyle}>{errorMessage}</div> : null}
        </div>
      </div>
    );
  }

  return content;
}

export function IssueHubSurface(props: IssueHubSurfaceProps) {
  const router = useRouter();
  const [isCreateWorkspaceDialogOpen, setIsCreateWorkspaceDialogOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlugInput, setWorkspaceSlugInput] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectKeyInput, setProjectKeyInput] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const workspaceSlugPreview = useMemo(() => {
    if (workspaceSlugInput.trim().length === 0 && workspaceName.trim().length === 0) {
      return "";
    }

    if (workspaceSlugInput.trim().length > 0) {
      return normalizeWorkspaceSlugClient(workspaceSlugInput.trim());
    }

    return buildWorkspaceSlugCandidatesClient(workspaceName.trim(), 1)[0];
  }, [workspaceName, workspaceSlugInput]);
  const projectKeyPreview = useMemo(() => {
    if (projectKeyInput.trim().length === 0 && projectName.trim().length === 0) {
      return "";
    }

    if (projectKeyInput.trim().length > 0) {
      return normalizeProjectKeyClient(projectKeyInput.trim());
    }

    return buildProjectKeyCandidatesClient(projectName.trim(), 1)[0];
  }, [projectKeyInput, projectName]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) {
      return;
    }

    setSetupError(null);
    setSetupStatus("Creating workspace...");
    setIsSettingUp(true);

    try {
      const requestedSlug = workspaceSlugInput.trim();
      const workspace = await createWorkspace({
        name: workspaceName.trim(),
        ...(requestedSlug.length > 0 ? { slug: requestedSlug } : {})
      });
      const readableWorkspace = await waitForWorkspaceRead(workspace.slug);
      setWorkspaceName("");
      setWorkspaceSlugInput("");
      setIsCreateWorkspaceDialogOpen(false);
      setSetupStatus(`Workspace ${readableWorkspace.slug} is ready.`);
      router.push(getWorkspaceHref(readableWorkspace.slug));
      router.refresh();
    } catch (error) {
      setSetupStatus(null);
      setSetupError(error instanceof Error ? error.message : "Workspace creation failed");
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleCreateProject = async (workspaceSlug: string) => {
    if (!projectName.trim()) {
      return;
    }

    setSetupError(null);
    setSetupStatus("Creating project...");
    setIsSettingUp(true);

    try {
      const requestedProjectKey = projectKeyInput.trim();
      const project = await createProject(workspaceSlug, {
        name: projectName.trim(),
        ...(requestedProjectKey.length > 0 ? { key: requestedProjectKey } : {})
      });
      const readableProject = await waitForProjectRead(workspaceSlug, project.key ?? projectKeyPreview);
      setProjectName("");
      setProjectKeyInput("");
      setIsCreateProjectDialogOpen(false);
      setSetupStatus(`Project ${readableProject.key} is ready.`);
      router.push(getProjectHref(workspaceSlug, readableProject.key));
      router.refresh();
    } catch (error) {
      setSetupStatus(null);
      setSetupError(error instanceof Error ? error.message : "Project creation failed");
    } finally {
      setIsSettingUp(false);
    }
  };

  if (props.mode === "bootstrap") {
    return (
      <AppShell
        viewer={props.shellViewer}
        workspaces={props.shellWorkspaces}
        title="Workspaces"
        subtitle="Choose a workspace or create a new one."
        breadcrumbs={[
          { label: "Home" },
          { label: "Workspace chooser" }
        ]}
        actions={
          <Button variant="outline" onClick={() => setIsCreateWorkspaceDialogOpen(true)}>
            Create workspace
          </Button>
        }
        sidebar={
          <>
            <SidebarGroup title="Work">
              {props.workspaces.map((workspace) => (
                <SidebarLink
                  key={workspace.id}
                  href={getWorkspaceHref(workspace.slug)}
                  label={workspace.name}
                  active={false}
                  meta={workspace.slug}
                />
              ))}
            </SidebarGroup>
            <SidebarGroup title="Manage">
              <SidebarActionButton
                label="Create workspace"
                onClick={() => setIsCreateWorkspaceDialogOpen(true)}
              />
              <SidebarLink href="/settings" label="Settings" />
            </SidebarGroup>
          </>
        }
      >
        <div style={contentBoxStyle}>
          <div style={smallMutedStyle}>Open an existing workspace or create a new one when you need a fresh space for work.</div>
          <div style={workspaceCardGridStyle}>
            {props.workspaces.map((workspace) => {
              const projectList = props.projectsByWorkspace[workspace.id] ?? [];

              return (
                <Card
                  key={workspace.id}
                  title={workspace.name}
                  subtitle={workspace.slug}
                  actions={
                    <Link href={getWorkspaceHref(workspace.slug)} style={primaryButtonStyle}>
                      Open workspace
                    </Link>
                  }
                >
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <StatusChip status="todo" />
                      <PriorityChip priority="medium" />
                    </div>
                    <div style={smallMutedStyle}>Projects {formatCount(projectList.length)}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {projectList.map((project) => (
                        <Link key={project.id} href={getProjectHref(workspace.slug, project.key)} style={linkButtonStyle}>
                          {project.key} · {project.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Dialog open={isCreateWorkspaceDialogOpen} onOpenChange={setIsCreateWorkspaceDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create workspace</DialogTitle>
                <DialogDescription>
                  Create a new workspace, then move straight into project setup.
                </DialogDescription>
              </DialogHeader>
              <div style={{ display: "grid", gap: tokens.spacing.md }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 13, color: surfaceColor.muted }} htmlFor="bootstrap-workspace-name">
                    Workspace name
                  </label>
                  <input
                    id="bootstrap-workspace-name"
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    placeholder="Enter workspace name"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 13, color: surfaceColor.muted }} htmlFor="bootstrap-workspace-slug">
                    Workspace slug (optional)
                  </label>
                  <input
                    id="bootstrap-workspace-slug"
                    value={workspaceSlugInput}
                    onChange={(event) => setWorkspaceSlugInput(event.target.value)}
                    placeholder="Optional custom URL slug"
                    style={inputStyle}
                  />
                  <div style={smallMutedStyle}>
                    {workspaceSlugPreview ? (
                      <>
                        Public URL: <strong style={{ color: surfaceColor.foreground }}>{workspaceSlugPreview}</strong>
                      </>
                    ) : (
                      "A URL slug will be generated from the workspace name."
                    )}
                  </div>
                </div>
                {setupStatus ? <div style={emptyStateStyle}>{setupStatus}</div> : null}
                {setupError ? <div style={emptyStateStyle}>{setupError}</div> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateWorkspaceDialogOpen(false)} disabled={isSettingUp}>
                  Cancel
                </Button>
                <Button onClick={() => void handleCreateWorkspace()} disabled={isSettingUp || workspaceName.trim().length === 0}>
                  {isSettingUp ? "Creating..." : "Create workspace"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppShell>
    );
  }

  if (props.mode === "workspace") {
    const projectKeyById = Object.fromEntries(props.projects.map((project) => [project.id, project.key]));

    return (
      <AppShell
        viewer={props.shellViewer}
        workspaces={props.shellWorkspaces}
        currentWorkspaceSlug={props.workspace.slug}
        title={props.workspace.name}
        subtitle={`${props.workspace.slug} workspace overview`}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: props.workspace.name }
        ]}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSetupError(null);
                setSetupStatus(null);
                setIsCreateProjectDialogOpen(true);
              }}
            >
              Create project
            </Button>
            <Link href={getMyIssuesHref({ workspaceSlug: props.workspace.slug })} style={secondaryButtonStyle}>
              My issues
            </Link>
            <Link href={getWorkspaceMembersHref(props.workspace.slug)} style={secondaryButtonStyle}>
              Members
            </Link>
            <Link href={getWorkspaceAccessHref(props.workspace.slug)} style={secondaryButtonStyle}>
              Access
            </Link>
            <Link href={getWorkspaceIntegrationsHref(props.workspace.slug)} style={secondaryButtonStyle}>
              Integrations
            </Link>
          </>
        }
        sidebar={
          <>
            <SidebarGroup title="Work">
              <SidebarLink href={getWorkspaceHref(props.workspace.slug)} label="Workspace overview" active />
              <SidebarLink href={getMyIssuesHref({ workspaceSlug: props.workspace.slug })} label="My issues" />
              {props.projects.map((project) => (
                <SidebarLink
                  key={project.id}
                  href={getProjectHref(props.workspace.slug, project.key)}
                  label={`${project.key} · ${project.name}`}
                  meta={project.currentUserRole}
                />
              ))}
            </SidebarGroup>
            <SidebarGroup title="Manage">
              <SidebarActionButton
                label="Create project"
                onClick={() => {
                  setSetupError(null);
                  setSetupStatus(null);
                  setIsCreateProjectDialogOpen(true);
                }}
              />
              <SidebarLink href={getWorkspaceMembersHref(props.workspace.slug)} label="Members" />
              <SidebarLink href={getWorkspaceAccessHref(props.workspace.slug)} label="Access" />
              <SidebarLink href={getWorkspaceIntegrationsHref(props.workspace.slug)} label="Integrations" />
              <SidebarLink href="/settings" label="Settings" />
            </SidebarGroup>
          </>
        }
      >
        <div className="grid gap-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
            <Card
              title="Projects"
              subtitle="Move between projects without scanning oversized cards."
              actions={<div style={smallMutedStyle}>{formatCount(props.projects.length)}</div>}
            >
              {props.projects.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/50">
                  {props.projects.map((project) => (
                    <div
                      key={project.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 px-4 py-3 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <Link
                          href={getProjectHref(props.workspace.slug, project.key)}
                          className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          {project.key} · {project.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{project.currentUserRole}</span>
                          <span className="text-border">•</span>
                          <span>{project.visibility === "workspace" ? "Workspace visible" : "Private project"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={getProjectIntegrationsHref(props.workspace.slug, project.key)}>Integrations</Link>
                        </Button>
                        <Button asChild size="sm" variant="subtle">
                          <Link href={getProjectHref(props.workspace.slug, project.key)}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={emptyStateStyle}>No projects yet. Create the first project from the top-right action.</div>
              )}
            </Card>
            <Card
              title="Recent issues"
              subtitle="A compact list for quick scanning across the workspace."
              actions={<div style={smallMutedStyle}>{formatCount(props.recentIssues.length)}</div>}
            >
              <IssueListTable
                issues={props.recentIssues}
                projectKeyById={projectKeyById}
                showProject
                workspaceSlug={props.workspace.slug}
              />
            </Card>
          </div>
          <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create project</DialogTitle>
                <DialogDescription>
                  Start a new project in {props.workspace.name} and move directly into its issue view.
                </DialogDescription>
              </DialogHeader>
              <div style={{ display: "grid", gap: tokens.spacing.md }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 13, color: surfaceColor.muted }} htmlFor="workspace-project-name">
                    Project name
                  </label>
                  <input
                    id="workspace-project-name"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Enter project name"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  <label style={{ fontSize: 13, color: surfaceColor.muted }} htmlFor="workspace-project-key">
                    Project key (optional)
                  </label>
                  <input
                    id="workspace-project-key"
                    value={projectKeyInput}
                    onChange={(event) => setProjectKeyInput(event.target.value)}
                    placeholder="Optional project key"
                    style={inputStyle}
                  />
                  <div style={smallMutedStyle}>
                    {projectKeyPreview ? (
                      <>
                        Issue prefix: <strong style={{ color: surfaceColor.foreground }}>{projectKeyPreview}</strong>
                      </>
                    ) : (
                      "An issue prefix will be generated from the project name."
                    )}
                  </div>
                </div>
                {setupStatus ? <div style={emptyStateStyle}>{setupStatus}</div> : null}
                {setupError ? <div style={emptyStateStyle}>{setupError}</div> : null}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateProjectDialogOpen(false)} disabled={isSettingUp}>
                  Cancel
                </Button>
                <Button onClick={() => void handleCreateProject(props.workspace.slug)} disabled={isSettingUp || projectName.trim().length === 0}>
                  {isSettingUp ? "Creating..." : "Create project"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      viewer={props.shellViewer}
      workspaces={props.shellWorkspaces}
      currentWorkspaceSlug={props.workspace.slug}
      title={`${props.project.key} · ${props.project.name}`}
      subtitle={`${props.workspace.name} project workspace`}
      newIssueHref={getProjectHref(props.workspace.slug, props.project.key, "new")}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: props.workspace.name, href: getWorkspaceHref(props.workspace.slug) },
        { label: props.project.key }
      ]}
      actions={
        <>
          <Link href={getMyIssuesHref({ workspaceSlug: props.workspace.slug })} style={secondaryButtonStyle}>
            My issues
          </Link>
          <Link href={getProjectAccessHref(props.workspace.slug, props.project.key)} style={secondaryButtonStyle}>
            Project access
          </Link>
        </>
      }
      tabs={
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href={getProjectHref(props.workspace.slug, props.project.key, "issues")}
              className={tabLinkClassName(props.mode === "issues" || props.mode === "create" || props.mode === "issue")}
            >
              Issues
            </Link>
            <Link
              href={getProjectHref(props.workspace.slug, props.project.key, "board")}
              className={tabLinkClassName(props.mode === "board")}
            >
              Board
            </Link>
            <Link
              href={getProjectHref(props.workspace.slug, props.project.key, "triage")}
              className={tabLinkClassName(props.mode === "triage")}
            >
              Triage
            </Link>
          </div>
          {props.mode === "issues" ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={getProjectHref(props.workspace.slug, props.project.key, "issues")}
                className={tabLinkClassName((props.currentScope ?? "all") === "all")}
              >
                All
              </Link>
              <Link
                href={`${getProjectHref(props.workspace.slug, props.project.key, "issues")}?scope=assigned`}
                className={tabLinkClassName((props.currentScope ?? "all") === "assigned")}
              >
                Assigned to me
              </Link>
              <Link
                href={`${getProjectHref(props.workspace.slug, props.project.key, "issues")}?scope=created`}
                className={tabLinkClassName((props.currentScope ?? "all") === "created")}
              >
                Created by me
              </Link>
            </div>
          ) : null}
        </div>
      }
      sidebar={
        <ProjectSidebarNav
          mode={props.mode === "board" ? "board" : props.mode === "triage" ? "triage" : "issues"}
          project={props.project}
          projects={props.projects}
          workspace={props.workspace}
        />
      }
    >
      <div style={stackStyle}>
        <IssueHubProjectPage
          workspace={props.workspace}
          project={props.project}
          initialIssues={props.issues}
          currentScope={props.currentScope ?? "all"}
          mode={props.mode}
          issue={props.issue}
          workspaceMembers={props.workspaceMembers ?? []}
        />
      </div>
    </AppShell>
  );
}
