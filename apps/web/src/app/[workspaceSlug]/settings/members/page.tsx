import { notFound } from "next/navigation";

import { ShellPageState } from "@/components/shell-page-state";
import { WorkspaceAdminShell } from "@/components/workspace-admin-shell";
import { WorkspaceMembersSurface } from "@/components/workspace-members-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getRequestStatus } from "@/lib/request-error";
import {
  getProjectsForWorkspace,
  getWorkspaceBySlug,
  getWorkspaceInvitations,
  getWorkspaceMembers
} from "@/lib/server-api";

type MembersSettingsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function MembersSettingsPage({ params }: MembersSettingsPageProps) {
  const { workspaceSlug } = await params;
  const session = await requireCurrentAuthSession(`/${workspaceSlug}/settings/members`);
  let workspace;

  try {
    workspace = await getWorkspaceBySlug(workspaceSlug);
  } catch (error) {
    if (getRequestStatus(error) === 401 || getRequestStatus(error) === 403) {
      return (
        <ShellPageState
          tone="warning"
          eyebrow="Workspace access"
          title="This workspace cannot be managed by your current account"
          shellTitle="Workspace members unavailable"
          shellSubtitle="Workspace administration stays in the same shell, even when access is blocked."
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

  const [projects, members, invitations] = await Promise.all([
    getProjectsForWorkspace(workspace.slug),
    getWorkspaceMembers(workspace.slug),
    getWorkspaceInvitations(workspace.slug)
  ]);

  return (
    <WorkspaceAdminShell active="members" projects={projects} workspace={workspace}>
      <WorkspaceMembersSurface
        currentUser={{ id: session.userId }}
        initialInvitations={invitations}
        initialMembers={members}
        workspace={workspace}
      />
    </WorkspaceAdminShell>
  );
}
