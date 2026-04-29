import type { WorkspaceMemberDto, WorkspaceRole } from "@wevlo/contracts";

import {
  type WorkspaceSettingsCapabilities,
  type WorkspaceSettingsMemberRow,
  type WorkspaceSettingsPendingInviteRow,
  type WorkspaceSettingsSectionData
} from "@/components/workspace-members-settings-section";
import { SettingsPageClient } from "@/components/settings-page-client";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import {
  getMe,
  getWorkspaceBySlug,
  getWorkspaceInvitations,
  getWorkspaceMembers,
  listWorkspaces
} from "@/lib/server-api";

const roleHierarchy: Record<WorkspaceRole, number> = {
  Owner: 0,
  Maintainer: 1,
  Member: 2,
  Developer: 3,
  Guest: 4
};

const isWorkspaceRole = (value: string): value is WorkspaceRole =>
  value === "Owner" || value === "Maintainer" || value === "Member" || value === "Developer" || value === "Guest";

const workspaceCapabilitiesByRole: Record<WorkspaceRole, WorkspaceSettingsCapabilities> = {
  Owner: {
    canInviteMembers: true,
    canManageMembers: true,
    canViewMembers: true
  },
  Maintainer: {
    canInviteMembers: true,
    canManageMembers: true,
    canViewMembers: true
  },
  Member: {
    canInviteMembers: false,
    canManageMembers: false,
    canViewMembers: true
  },
  Developer: {
    canInviteMembers: false,
    canManageMembers: false,
    canViewMembers: true
  },
  Guest: {
    canInviteMembers: false,
    canManageMembers: false,
    canViewMembers: true
  }
};

const findCurrentMembership = (
  members: WorkspaceMemberDto[],
  currentUserId: string,
  currentUserEmail: string | null
): WorkspaceMemberDto | null => {
  const normalizedEmail = currentUserEmail?.trim().toLowerCase() ?? null;
  const exactMatch = members.find((member) => member.userId === currentUserId);

  if (exactMatch) {
    return exactMatch;
  }

  if (!normalizedEmail) {
    return null;
  }

  return members.find((member) => member.user.email?.trim().toLowerCase() === normalizedEmail) ?? null;
};

const getAssignableRoles = (currentUserRole: WorkspaceRole, memberRole: WorkspaceRole): WorkspaceRole[] => {
  if (memberRole === "Owner") {
    return ["Owner"];
  }

  if (currentUserRole === "Owner") {
    return ["Maintainer", "Member", "Developer", "Guest"];
  }

  if (currentUserRole === "Maintainer") {
    return ["Member", "Developer", "Guest"];
  }

  return [memberRole];
};

const buildMemberRows = (
  members: WorkspaceMemberDto[],
  currentMembershipUserId: string,
  currentUserRole: WorkspaceRole,
  capabilities: WorkspaceSettingsCapabilities
): WorkspaceSettingsMemberRow[] =>
  members.map((member) => {
    const isCurrentUser = member.userId === currentMembershipUserId;
    const isOwnerRow = member.role === "Owner";
    const isEditableByCurrentUser =
      capabilities.canManageMembers &&
      !isCurrentUser &&
      !isOwnerRow &&
      (currentUserRole === "Owner" || roleHierarchy[member.role] > roleHierarchy[currentUserRole]);

    return {
      assignableRoles: getAssignableRoles(currentUserRole, member.role),
      email: member.user.email,
      isCurrentUser,
      isEditableByCurrentUser,
      isRemovableByCurrentUser: isEditableByCurrentUser,
      name: member.user.name,
      role: member.role,
      status: "Active",
      userId: member.userId
    };
  });

const buildPendingInvites = (
  invitations: Awaited<ReturnType<typeof getWorkspaceInvitations>>
): WorkspaceSettingsPendingInviteRow[] =>
  invitations
    .filter((invitation) => invitation.status === "pending" || invitation.status === "delivery_failed")
    .map((invitation) => ({
      email: invitation.inviteeEmail ?? invitation.inviteeUserId ?? invitation.id,
      id: invitation.id,
      inviteHref: `/invite/${encodeURIComponent(invitation.acceptToken ?? invitation.id)}`,
      role: isWorkspaceRole(invitation.role) ? invitation.role : "Guest",
      status: invitation.status === "delivery_failed" ? "Delivery failed" : "Invited"
    }));

type SettingsPageProps = {
  searchParams: Promise<{
    section?: string;
    workspaceSlug?: string;
  }>;
};

const resolveSection = (value: string | undefined): "preferences" | "profile" | "workspace" => {
  if (value === "preferences") {
    return "preferences";
  }

  if (value === "workspace") {
    return "workspace";
  }

  return "profile";
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [authSession, me, workspaces, resolvedSearchParams] = await Promise.all([
    requireCurrentAuthSession("/settings"),
    getMe(),
    listWorkspaces(),
    searchParams
  ]);
  const selectedWorkspaceSlug = workspaces.some((workspace) => workspace.slug === resolvedSearchParams.workspaceSlug)
    ? resolvedSearchParams.workspaceSlug ?? null
    : (workspaces[0]?.slug ?? null);
  const workspaceSectionData: WorkspaceSettingsSectionData | null = selectedWorkspaceSlug
    ? await (async () => {
        const workspace = await getWorkspaceBySlug(selectedWorkspaceSlug);

        if (!workspace) {
          return null;
        }

        const [members, invitations] = await Promise.all([
          getWorkspaceMembers(workspace.slug),
          getWorkspaceInvitations(workspace.slug)
        ]);
        const currentMembership = findCurrentMembership(members, authSession.userId, me.user.email);
        const currentUserRole = currentMembership?.role ?? "Guest";
        const capabilities = workspaceCapabilitiesByRole[currentUserRole];

        return {
          capabilities,
          currentUserRole,
          members: buildMemberRows(
            members,
            currentMembership?.userId ?? authSession.userId,
            currentUserRole,
            capabilities
          ),
          pendingInvites: buildPendingInvites(invitations),
          selectedWorkspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug
          }
        };
      })()
    : null;

  const backHref = authSession.defaultWorkspaceSlug ? `/${authSession.defaultWorkspaceSlug}` : "/";

  return (
    <SettingsPageClient
      backHref={backHref}
      initialSection={resolveSection(resolvedSearchParams.section)}
      initialWorkspaceSlug={selectedWorkspaceSlug}
      user={me.user}
      workspaces={workspaces}
      workspaceSectionData={workspaceSectionData}
    />
  );
}
