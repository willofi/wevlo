"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { ProjectSummaryDto } from "@wevlo/contracts";
import { cn } from "@wevlo/ui-web";

import {
  getProjectAccessHref,
  getProjectHref,
  getProjectIntegrationsHref,
  getWorkspaceAccessHref,
  getWorkspaceHref,
  getWorkspaceMembersHref
} from "@/lib/issue-hub-data";

type ProjectSidebarMode = "issues" | "board" | "triage" | "project-access" | "integrations";

type ProjectSidebarNavProps = {
  mode: ProjectSidebarMode;
  project: ProjectSummaryDto;
  projects: ProjectSummaryDto[];
  workspace: {
    slug: string;
  };
};

function SidebarGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mt-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{title}</div>
      <div className="mt-1.5 grid gap-1">{children}</div>
    </section>
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
      className={cn(
        "flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[13px] font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/60"
      )}
    >
      <span>{label}</span>
      {meta ? <span className="text-[10px] text-muted-foreground">{meta}</span> : null}
    </Link>
  );
}

export function ProjectSidebarNav({
  mode,
  project,
  projects,
  workspace
}: ProjectSidebarNavProps) {
  return (
    <>
      <SidebarGroup title="Work">
        <SidebarLink href={getWorkspaceHref(workspace.slug)} label="Workspace overview" />
        <SidebarLink href={`/${workspace.slug}/my-issues`} label="My issues" />
        <SidebarLink
          href={getProjectHref(workspace.slug, project.key, "issues")}
          label="Issues"
          active={mode === "issues"}
        />
        <SidebarLink
          href={getProjectHref(workspace.slug, project.key, "board")}
          label="Board"
          active={mode === "board"}
        />
        <SidebarLink
          href={getProjectHref(workspace.slug, project.key, "triage")}
          label="Triage"
          active={mode === "triage"}
        />
      </SidebarGroup>
      <SidebarGroup title="Switch project">
        {projects.map((candidate) => (
          <SidebarLink
            key={candidate.id}
            href={getProjectHref(workspace.slug, candidate.key, mode === "board" ? "board" : mode === "triage" ? "triage" : undefined)}
            label={`${candidate.key} · ${candidate.name}`}
            active={candidate.key === project.key}
            meta={candidate.currentUserRole}
          />
        ))}
      </SidebarGroup>
      <SidebarGroup title="Manage">
        <SidebarLink href={getWorkspaceMembersHref(workspace.slug)} label="Members" />
        <SidebarLink href={getWorkspaceAccessHref(workspace.slug)} label="Workspace access" />
        <SidebarLink
          href={getProjectAccessHref(workspace.slug, project.key)}
          label="Project access"
          active={mode === "project-access"}
        />
        <SidebarLink
          href={getProjectIntegrationsHref(workspace.slug, project.key)}
          label="Integrations"
          active={mode === "integrations"}
        />
        <SidebarLink href={`/${workspace.slug}/${project.key}/settings/board`} label="Board settings" />
        <SidebarLink href="/settings" label="Settings" />
      </SidebarGroup>
    </>
  );
}
