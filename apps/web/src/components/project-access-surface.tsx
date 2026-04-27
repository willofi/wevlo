"use client";

import Link from "next/link";
import { ShieldCheck, UserPlus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import type {
  ProjectMemberDto,
  ProjectRole,
  ProjectSummaryDto,
  WorkspaceDto,
  WorkspaceMemberDto
} from "@wevlo/contracts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@wevlo/ui-web";

import { AppShell } from "@/components/app-shell";
import { PageState, pageStateButtonClassName } from "@/components/page-state";
import {
  getProjectAccessHref,
  getProjectHref,
  getWorkspaceAccessHref,
  getWorkspaceHref,
  getWorkspaceMembersHref,
  removeProjectMember,
  upsertProjectMember
} from "@/lib/issue-hub-data";

type ProjectAccessSurfaceProps = {
  initialMembers: ProjectMemberDto[];
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
  workspace: WorkspaceDto;
  workspaceMembers: WorkspaceMemberDto[];
};

const projectRoles: ProjectRole[] = ["Owner", "Maintainer", "Developer", "Planner", "Guest"];

const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export const ProjectAccessSurface = ({
  initialMembers,
  project,
  projects,
  shellViewer,
  shellWorkspaces,
  workspace,
  workspaceMembers
}: ProjectAccessSurfaceProps) => {
  const [members, setMembers] = useState(initialMembers);
  const [selectedUserId, setSelectedUserId] = useState(workspaceMembers[0]?.userId ?? "");
  const [selectedRole, setSelectedRole] = useState<ProjectRole>("Developer");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const memberIds = useMemo(() => new Set(members.map((member) => member.userId)), [members]);
  const availableWorkspaceMembers = useMemo(
    () => workspaceMembers.filter((member) => !memberIds.has(member.userId)),
    [memberIds, workspaceMembers]
  );

  const handleUpsert = async (userId: string, role: ProjectRole) => {
    try {
      setIsSaving(true);
      setError(null);
      const member = await upsertProjectMember(workspace.slug, project.key, userId, { role });
      setMembers((current) => {
        const next = current.filter((candidate) => candidate.userId !== userId);
        return [...next, member].sort((left, right) => left.user.name.localeCompare(right.user.name));
      });
      setSelectedUserId(availableWorkspaceMembers[0]?.userId ?? "");
      setSelectedRole("Developer");
    } catch (upsertError) {
      setError(upsertError instanceof Error ? upsertError.message : "Project access update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setIsSaving(true);
      setError(null);
      await removeProjectMember(workspace.slug, project.key, userId);
      setMembers((current) => current.filter((candidate) => candidate.userId !== userId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Project access removal failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      viewer={shellViewer}
      workspaces={shellWorkspaces}
      currentWorkspaceSlug={workspace.slug}
      title={`${project.key} access`}
      subtitle={`${workspace.name} workspace permissions for ${project.name}`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: workspace.name, href: getWorkspaceHref(workspace.slug) },
        { label: project.key, href: getProjectHref(workspace.slug, project.key) },
        { label: "Project access" }
      ]}
      workspaceActionsContext={{
        currentProjectKey: project.key,
        projects,
        workspaceMembers,
        workspaceSlug: workspace.slug
      }}
      sidebar={
        <>
          <SidebarGroup title="Workspace">
            <SidebarLink href={getWorkspaceHref(workspace.slug)} label={workspace.name} meta={workspace.slug} />
            <SidebarLink href={getWorkspaceMembersHref(workspace.slug)} label="Members" />
            <SidebarLink href={getWorkspaceAccessHref(workspace.slug)} label="Workspace access" />
          </SidebarGroup>
          <SidebarGroup title="Views">
            <SidebarLink href={getProjectHref(workspace.slug, project.key, "issues")} label="Issues" />
            <SidebarLink href={`${getProjectHref(workspace.slug, project.key, "issues")}?scope=assigned`} label="Assigned to me" />
            <SidebarLink href={`${getProjectHref(workspace.slug, project.key, "issues")}?scope=created`} label="Created by me" />
            <SidebarLink href={getProjectHref(workspace.slug, project.key, "board")} label="Board" />
            <SidebarLink href={getProjectHref(workspace.slug, project.key, "triage")} label="Triage" />
            <SidebarLink href={`/${workspace.slug}/${project.key}/settings/board`} label="Board settings" />
            <SidebarLink href={getProjectAccessHref(workspace.slug, project.key)} label="Project access" active />
          </SidebarGroup>
          <SidebarGroup title="Projects">
            {projects.map((candidate) => (
              <SidebarLink
                key={candidate.id}
                href={getProjectAccessHref(workspace.slug, candidate.key)}
                label={`${candidate.key} · ${candidate.name}`}
                active={candidate.key === project.key}
                meta={candidate.currentUserRole}
              />
            ))}
          </SidebarGroup>
        </>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="shadow-none">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <UserPlus className="size-4" />
              Grant project access
            </div>
            <CardTitle>Project membership</CardTitle>
            <CardDescription>
              Workspace membership does not automatically grant access. Add people to {project.key} with the least privilege they need.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {workspaceMembers.length === 0 ? (
              <PageState
                eyebrow="No workspace members"
                title="Invite teammates before assigning project access"
                body={`Nobody can be added to ${project.key} until they belong to the workspace first.`}
                actions={
                  <Link href={getWorkspaceMembersHref(workspace.slug)} className={pageStateButtonClassName}>
                    Manage workspace members
                  </Link>
                }
              />
            ) : (
              <>
                <label className="grid gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Workspace member</span>
                  <select
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                    className={selectClassName}
                  >
                    <option value="">Select workspace member</option>
                    {workspaceMembers.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.user.name} · {member.role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Project role</span>
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as ProjectRole)}
                    className={selectClassName}
                  >
                    {projectRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  onClick={() => void handleUpsert(selectedUserId, selectedRole)}
                  disabled={isSaving || selectedUserId.length === 0}
                  className="w-full justify-center"
                >
                  {isSaving ? "Saving..." : "Add or update member"}
                </Button>
                {error ? (
                  <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}
                {availableWorkspaceMembers.length === 0 ? (
                  <PageState
                    eyebrow="Everything assigned"
                    title="Everyone in the workspace already has project access"
                    body="Update an existing role or remove someone before inviting another teammate to this project."
                  />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              <ShieldCheck className="size-4" />
              Current project access
            </div>
            <CardTitle>
              {members.length} member{members.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Review role assignments and trim access when a teammate no longer needs visibility into this project.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {members.length === 0 ? (
              <PageState
                eyebrow="No project members"
                title="Grant the first access role"
                body={`This project is empty right now. Add someone to ${project.key} to get the team moving.`}
              />
            ) : (
              members.map((member) => (
                <section
                  key={member.userId}
                  className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/45 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{member.user.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {member.user.email ?? member.userId} · workspace {workspace.slug}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={member.role}
                      onChange={(event) => void handleUpsert(member.userId, event.target.value as ProjectRole)}
                      className={cn(selectClassName, "sm:w-44")}
                      disabled={isSaving}
                    >
                      {projectRoles.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      className="border-destructive/35 text-destructive hover:bg-destructive/10"
                      onClick={() => void handleRemove(member.userId)}
                      disabled={isSaving}
                    >
                      Remove
                    </Button>
                  </div>
                </section>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

function SidebarGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="mt-3">
      <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{title}</div>
      <div className="mt-2 grid gap-1">{children}</div>
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
        active ? "bg-primary/12 text-primary" : "text-foreground hover:bg-secondary/65"
      )}
    >
      <span>{label}</span>
      {meta ? <span className="text-[10px] text-muted-foreground">{meta}</span> : null}
    </Link>
  );
}
