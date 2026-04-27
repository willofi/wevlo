import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Shield, UserRound } from "lucide-react";
import Link from "next/link";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wevlo/ui-web";

import { ShellPageState } from "@/components/shell-page-state";
import { WorkspaceAdminShell } from "@/components/workspace-admin-shell";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getWorkspaceMembersHref } from "@/lib/issue-hub-data";
import { getRequestStatus } from "@/lib/request-error";
import {
  getProjectsForWorkspace,
  getWorkspaceBySlug,
  getWorkspaceMembers
} from "@/lib/server-api";

type WorkspaceMemberProfilePageProps = {
  params: Promise<{
    userId: string;
    workspaceSlug: string;
  }>;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium"
  }).format(new Date(value));

export default async function WorkspaceMemberProfilePage({ params }: WorkspaceMemberProfilePageProps) {
  const { userId, workspaceSlug } = await params;
  await requireCurrentAuthSession(`/${workspaceSlug}/members/${userId}`);
  let workspace;

  try {
    workspace = await getWorkspaceBySlug(workspaceSlug);
  } catch (error) {
    if (getRequestStatus(error) === 401 || getRequestStatus(error) === 403) {
      return (
        <ShellPageState
          tone="warning"
          eyebrow="Workspace access"
          title="This member profile cannot be opened by your current account"
          shellTitle="Member profile unavailable"
          shellSubtitle="Workspace member profiles stay inside the workspace shell."
          body={`Ask a workspace owner to invite you to ${workspaceSlug}, or open a workspace you already belong to.`}
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: workspaceSlug },
            { label: "Members" }
          ]}
          actionLabel="Go home"
        />
      );
    }

    throw error;
  }

  if (!workspace) {
    notFound();
  }

  const [projects, members] = await Promise.all([
    getProjectsForWorkspace(workspace.slug),
    getWorkspaceMembers(workspace.slug)
  ]);
  const member = members.find((candidate) => candidate.userId === userId);

  if (!member) {
    notFound();
  }

  return (
    <WorkspaceAdminShell active="members" projects={projects} workspace={workspace}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden bg-card/85">
          <CardHeader className="border-b border-border/60 bg-secondary/25">
            <div className="mb-5">
              <Button asChild variant="ghost" size="sm">
                <Link href={getWorkspaceMembersHref(workspace.slug)}>
                  <ArrowLeft className="size-4" />
                  Back to members
                </Link>
              </Button>
            </div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex size-20 items-center justify-center rounded-3xl bg-primary/12 text-2xl font-bold text-primary ring-1 ring-primary/20">
                {member.user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Prototype profile
                </div>
                <CardTitle className="mt-2 text-3xl">{member.user.name}</CardTitle>
                <CardDescription className="mt-2 text-base">@{member.user.handle}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6">
            <div className="rounded-2xl border border-dashed border-border/80 bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
              This is a lightweight profile preview for mentions. Full profile editing, activity, and personal details can be wired in later.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <Mail className="size-3.5" />
                  Email
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground">{member.user.email ?? "No email on file"}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <Shield className="size-3.5" />
                  Workspace role
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground">{member.role}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <UserRound className="size-3.5" />
                  Joined
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground">{formatDate(member.createdAt)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/85">
          <CardHeader>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workspace context</div>
            <CardTitle>{workspace.name}</CardTitle>
            <CardDescription>Profile links are scoped to this workspace while the full profile surface is still a prototype.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-xl bg-secondary/35 px-3 py-2">
              <span className="text-muted-foreground">Workspace slug</span>
              <div className="font-mono text-foreground">{workspace.slug}</div>
            </div>
            <div className="rounded-xl bg-secondary/35 px-3 py-2">
              <span className="text-muted-foreground">User ID</span>
              <div className="break-all font-mono text-foreground">{member.userId}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </WorkspaceAdminShell>
  );
}
