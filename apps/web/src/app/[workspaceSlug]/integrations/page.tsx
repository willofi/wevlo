import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@wevlo/ui-web";

import { AppShell } from "@/components/app-shell";
import { getAppShellData } from "@/lib/app-shell-data";
import {
  getProjectHref,
  getProjectIntegrationsHref,
  getWorkspaceAccessHref,
  getWorkspaceHref,
  getWorkspaceIntegrationsHref,
  getWorkspaceMembersHref
} from "@/lib/issue-hub-data";
import {
  getProjectIntegrations,
  getProjectsForWorkspace,
  getWorkspaceBySlug,
  getWorkspaceIntegrations
} from "@/lib/server-api";

type WorkspaceIntegrationsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceIntegrationsPage({ params }: WorkspaceIntegrationsPageProps) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  if (!workspace) {
    notFound();
  }

  const [shellData, projects, installations] = await Promise.all([
    getAppShellData(),
    getProjectsForWorkspace(workspace.slug),
    getWorkspaceIntegrations(workspace.slug)
  ]);
  const projectStates = await Promise.all(
    projects.map(async (project) => ({
      integrationState: await getProjectIntegrations(workspace.slug, project.key),
      project
    }))
  );

  return (
    <AppShell
      viewer={shellData.viewer}
      workspaces={shellData.workspaces}
      currentWorkspaceSlug={workspace.slug}
      title={`${workspace.name} integrations`}
      subtitle={`${workspace.slug} workspace provider setup and project link overview`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: workspace.name, href: getWorkspaceHref(workspace.slug) },
        { label: "Integrations" }
      ]}
      actions={
        <>
          <Button asChild variant="outline">
            <Link href={getWorkspaceHref(workspace.slug)}>Workspace overview</Link>
          </Button>
          {projects[0] ? (
            <Button asChild>
              <Link href={getProjectIntegrationsHref(workspace.slug, projects[0].key)}>
                Open {projects[0].key} integrations
              </Link>
            </Button>
          ) : null}
        </>
      }
      sidebar={
        <>
          <section className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Work</div>
            <div className="mt-1.5 grid gap-1">
              <SidebarLink href={getWorkspaceHref(workspace.slug)} label="Workspace overview" />
              <SidebarLink href={`/${workspace.slug}/my-issues`} label="My issues" />
              {projects.map((project) => (
                <SidebarLink
                  key={project.id}
                  href={getProjectHref(workspace.slug, project.key)}
                  label={`${project.key} · ${project.name}`}
                  meta={project.currentUserRole}
                />
              ))}
            </div>
          </section>
          <section className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Manage</div>
            <div className="mt-1.5 grid gap-1">
              <SidebarLink href={getWorkspaceMembersHref(workspace.slug)} label="Members" />
              <SidebarLink href={getWorkspaceAccessHref(workspace.slug)} label="Access" />
              <SidebarLink href={getWorkspaceIntegrationsHref(workspace.slug)} label="Integrations" active />
              <SidebarLink href="/settings" label="Settings" />
            </div>
          </section>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Workspace installations</CardTitle>
            <CardDescription>Provider credentials and webhook secrets registered at the workspace level.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {installations.length === 0 ? (
              <div className="text-sm text-muted-foreground">No installations yet. Open a project integration screen to add the first one.</div>
            ) : (
              installations.map((installation) => (
                <div key={installation.id} className="rounded-lg border border-border/70 bg-background/55 p-4">
                  <div className="text-sm font-semibold">{installation.provider}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {installation.externalAccountSlug ?? installation.externalAccountId}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {installation.authType} · {installation.status}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Project integration map</CardTitle>
            <CardDescription>Each project keeps its own provider link and sync status.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {projectStates.map(({ integrationState, project }) => (
              <div key={project.id} className="rounded-lg border border-border/70 bg-background/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{project.key} · {project.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {integrationState.links.length} linked provider{integrationState.links.length === 1 ? "" : "s"} ·{" "}
                      {integrationState.syncStatuses.reduce((sum, item) => sum + item.pendingDeliveryCount, 0)} pending deliveries
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={getProjectIntegrationsHref(workspace.slug, project.key)}>Manage</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function SidebarLink({
  active,
  href,
  label,
  meta
}: {
  active?: boolean;
  href: string;
  label: string;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/60"
      ].join(" ")}
    >
      <span>{label}</span>
      {meta ? <span className="text-[10px] text-muted-foreground">{meta}</span> : null}
    </Link>
  );
}
