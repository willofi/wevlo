import Link from "next/link";
import { notFound } from "next/navigation";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wevlo/ui-web";

import { ShellPageState } from "@/components/shell-page-state";
import { WorkspaceAdminShell } from "@/components/workspace-admin-shell";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getProjectAccessHref, getWorkspaceMembersHref } from "@/lib/issue-hub-data";
import { getRequestStatus } from "@/lib/request-error";
import { getProjectsForWorkspace, getWorkspaceBySlug } from "@/lib/server-api";

type WorkspaceAccessPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceAccessPage({ params }: WorkspaceAccessPageProps) {
  const { workspaceSlug } = await params;
  await requireCurrentAuthSession(`/${workspaceSlug}/settings/access`);
  let workspace;

  try {
    workspace = await getWorkspaceBySlug(workspaceSlug);
  } catch (error) {
    if (getRequestStatus(error) === 401 || getRequestStatus(error) === 403) {
      return (
        <ShellPageState
          tone="warning"
          eyebrow="Workspace access"
          title="This workspace is not available to your account"
          shellTitle="Workspace access unavailable"
          shellSubtitle="Administration links remain in place so you can recover without losing navigation context."
          body={`Ask a workspace owner to invite you to ${workspaceSlug}, or switch to a workspace you already belong to.`}
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: workspaceSlug },
            { label: "Access" }
          ]}
          actionLabel="Return home"
        />
      );
    }

    throw error;
  }

  if (!workspace) {
    notFound();
  }

  const projects = await getProjectsForWorkspace(workspace.slug);

  return (
    <WorkspaceAdminShell active="access" projects={projects} workspace={workspace}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="shadow-none">
          <CardHeader className="space-y-3">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Access model</div>
            <CardTitle>Workspace first, project second</CardTitle>
            <CardDescription className="text-sm leading-7">
              Invite teammates into the workspace first, then grant access per project. This keeps collaboration explicit and avoids accidental visibility leaks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-full">
              <Link href={getWorkspaceMembersHref(workspace.slug)}>Manage workspace members</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="space-y-3">
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Project access</div>
            <CardTitle>Choose a project</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={getProjectAccessHref(workspace.slug, project.key)}
                className="rounded-lg border border-border/70 bg-background/55 p-4 text-foreground transition-colors hover:bg-secondary/65"
              >
                <div className="text-sm font-semibold">{project.key} · {project.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">Current role: {project.currentUserRole}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </WorkspaceAdminShell>
  );
}
