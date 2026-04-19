import Link from "next/link";
import type { PropsWithChildren } from "react";

import type { ProjectSummaryDto, WorkspaceDto } from "@wevlo/contracts";
import { cn } from "@wevlo/ui-web";

import { getAppShellData } from "@/lib/app-shell-data";
import { AppShell } from "@/components/app-shell";
import {
  getProjectHref,
  getWorkspaceAccessHref,
  getWorkspaceHref,
  getWorkspaceMembersHref
} from "@/lib/issue-hub-data";

type WorkspaceAdminShellProps = PropsWithChildren<{
  active: "members" | "access";
  projects: ProjectSummaryDto[];
  workspace: WorkspaceDto;
}>;

export const WorkspaceAdminShell = async ({ active, children, projects, workspace }: WorkspaceAdminShellProps) => {
  const shellData = await getAppShellData();

  return (
    <AppShell
      viewer={shellData.viewer}
      workspaces={shellData.workspaces}
      currentWorkspaceSlug={workspace.slug}
      title={workspace.name}
      subtitle={`${workspace.slug} workspace administration`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: workspace.name, href: getWorkspaceHref(workspace.slug) },
        { label: active === "members" ? "Members" : "Access" }
      ]}
      sidebar={
        <>
          <section className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Workspace</div>
            <div className="mt-2 grid gap-1">
              <Link href={getWorkspaceHref(workspace.slug)} className={sidebarLinkStyle(false)}>
                Overview
              </Link>
              <Link href={getWorkspaceMembersHref(workspace.slug)} className={sidebarLinkStyle(active === "members")}>
                Members
              </Link>
              <Link href={getWorkspaceAccessHref(workspace.slug)} className={sidebarLinkStyle(active === "access")}>
                Access
              </Link>
              <Link href={`/${workspace.slug}/my-issues`} className={sidebarLinkStyle(false)}>
                My issues
              </Link>
            </div>
          </section>
          <section className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Projects</div>
            <div className="mt-2 grid gap-1">
              {projects.map((project) => (
                <Link key={project.id} href={getProjectHref(workspace.slug, project.key)} className={sidebarLinkStyle(false)}>
                  {project.key} · {project.name}
                </Link>
              ))}
            </div>
          </section>
        </>
      }
    >
      {children}
    </AppShell>
  );
};

const sidebarLinkStyle = (active: boolean) =>
  cn(
    "block rounded-sm px-2 py-1.5 text-[13px] font-medium text-foreground transition-colors",
    active
      ? "bg-primary/12 text-primary"
      : "hover:bg-secondary/65"
  );
