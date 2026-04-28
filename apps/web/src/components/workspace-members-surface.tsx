"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  WorkspaceDto,
  WorkspaceInvitationResult,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
  WorkspaceRole
} from "@wevlo/contracts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn, Input } from "@wevlo/ui-web";

import { PageState, pageStateButtonStyle, pageStateLinkStyle } from "@/components/page-state";
import {
  createWorkspaceInvitation,
  getInviteHref,
  getWorkspaceMemberHref,
  removeWorkspaceMember,
  updateWorkspaceMember
} from "@/lib/issue-hub-data";

type WorkspaceMembersSurfaceProps = {
  initialInvitations: WorkspaceInvitationDto[];
  initialMembers: WorkspaceMemberDto[];
  workspace: WorkspaceDto;
  currentUser: { id: string };
};

const workspaceRoles: WorkspaceRole[] = ["Owner", "Maintainer", "Member", "Developer", "Guest"];

const roleHierarchy: Record<WorkspaceRole, number> = {
  Owner: 0,
  Maintainer: 1,
  Member: 2,
  Developer: 3,
  Guest: 4
};

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

const describeInviteFailure = (failure: WorkspaceInvitationResult): string => {
  if (failure.reason === "invalid_email") {
    return `${failure.email}: invalid email format`;
  }
  if (failure.reason === "email_send_failed") {
    if (failure.invitationId) {
      return `${failure.email}: invitation was created, but email delivery failed`;
    }
    return `${failure.email}: failed to send invitation email`;
  }
  if (failure.reason === "invite_create_failed") {
    return `${failure.email}: failed to create invitation`;
  }
  return `${failure.email}: unknown error`;
};

export const WorkspaceMembersSurface = ({
  initialInvitations,
  initialMembers,
  workspace,
  currentUser
}: WorkspaceMembersSurfaceProps) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("Member");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [invitations] = useState(initialInvitations);
  const [members, setMembers] = useState(initialMembers);

  const currentUserMembership = useMemo(
    () => members.find((m) => m.userId === currentUser.id),
    [members, currentUser.id]
  );

  const currentUserRole = currentUserMembership?.role ?? "Guest";
  const isOwner = currentUserRole === "Owner";
  const canInvite = currentUserRole === "Owner" || currentUserRole === "Maintainer" || currentUserRole === "Member";

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations]
  );

  const completedInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status !== "pending"),
    [invitations]
  );

  const handleInvite = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setStatusMessage(null);
      const emails = email
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      const results = await createWorkspaceInvitation(workspace.slug, {
        emails,
        role
      });
      const createdCount = results.filter((result) => result.status === "created").length;
      const alreadyMemberCount = results.filter((result) => result.status === "already_member").length;
      const failures = results.filter((result) => result.status === "failed");
      const failedCount = failures.length;

      if (failedCount > 0) {
        const failureSummary = failures.slice(0, 3).map(describeInviteFailure).join(" / ");
        const hasMore = failures.length > 3 ? ` (+${failures.length - 3} more)` : "";
        setError(`${failedCount} invitation(s) failed: ${failureSummary}${hasMore}`);
      }

      setEmail("");
      setRole("Member");
      setStatusMessage(`Created ${createdCount}, already members ${alreadyMemberCount}, failed ${failedCount}.`);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Invitation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: WorkspaceRole) => {
    try {
      setIsSaving(true);
      setError(null);
      const updatedMember = await updateWorkspaceMember(workspace.slug, userId, { role: newRole });
      setMembers((current) => current.map((m) => (m.userId === userId ? updatedMember : m)));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Role update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await removeWorkspaceMember(workspace.slug, userId);
      setMembers((current) => current.filter((m) => m.userId !== userId));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Member removal failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {canInvite && (
        <Card id="invite-form" className="bg-card/85">
          <CardHeader>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Invite teammate</div>
            <CardTitle>Workspace roster</CardTitle>
            <CardDescription>
              Invite collaborators into {workspace.name} before granting project-specific access.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com, teammate@company.com"
              type="text"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as WorkspaceRole)}
              className={selectClassName}
            >
              {workspaceRoles.map((r) => {
                const isDisabled = !isOwner && roleHierarchy[r] <= roleHierarchy[currentUserRole];
                return (
                  <option key={r} value={r} disabled={isDisabled}>
                    {r} {isDisabled ? "(Restricted)" : ""}
                  </option>
                );
              })}
            </select>
            <Button type="button" onClick={handleInvite} disabled={isSaving || email.length === 0}>
              {isSaving ? "Sending invite..." : "Send invitation"}
            </Button>
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}
            {statusMessage ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{statusMessage}</div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className={cn("bg-card/85", !canInvite && "lg:col-span-2")}>
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workspace members</div>
          <CardTitle>{members.length} active member{members.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <PageState
              eyebrow="No members yet"
              title="Invite the first teammate"
              body="This workspace is empty for now. Send an invite so the team can start collaborating."
              actions={
                isOwner ? (
                  <a href="#invite-form" style={pageStateButtonStyle}>
                    Invite someone
                  </a>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3">
              {members.map((member) => (
                <div key={member.userId} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={getWorkspaceMemberHref(workspace.slug, member.userId)}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {member.user.name}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground truncate">{member.user.email ?? member.userId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.userId !== currentUser.id ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) => void handleUpdateRole(member.userId, e.target.value as WorkspaceRole)}
                          className={cn(selectClassName, "h-8 w-32 text-[11px] py-0")}
                          disabled={
                            isSaving ||
                            (!isOwner && roleHierarchy[member.role] <= roleHierarchy[currentUserRole])
                          }
                        >
                          {workspaceRoles.map((r) => {
                            const isDisabled = !isOwner && roleHierarchy[r] <= roleHierarchy[currentUserRole];
                            return (
                              <option key={r} value={r} disabled={isDisabled}>
                                {r}
                              </option>
                            );
                          })}
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => void handleRemoveMember(member.userId)}
                          disabled={
                            isSaving ||
                            (!isOwner && roleHierarchy[member.role] <= roleHierarchy[currentUserRole])
                          }
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <div className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
                        {member.role} (You)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/85">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Pending invitations</div>
          <CardTitle>{pendingInvitations.length} waiting</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length === 0 ? (
            <PageState
              eyebrow="Nothing pending"
              title="No outstanding invitations"
              body="Once you send an invite, it will appear here with the acceptance link and expiry date."
            />
          ) : (
            <div className="grid gap-3">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {invitation.inviteeEmail ?? invitation.inviteeUserId ?? "Pending invite"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={getInviteHref(invitation.acceptToken ?? invitation.id)}>Open invite</a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/85 lg:col-span-2">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">History</div>
          <CardTitle>Recent invitation activity</CardTitle>
        </CardHeader>
        <CardContent>
          {completedInvitations.length === 0 ? (
            <PageState
              eyebrow="No history yet"
              title="Accepted or revoked invites will show here"
              body="This is where you can confirm who joined and which invitations expired or were revoked."
            />
          ) : (
            <div className="grid gap-3">
              {completedInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {invitation.inviteeEmail ?? invitation.inviteeUserId ?? invitation.id}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {invitation.status} · updated {new Date(invitation.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs font-semibold text-foreground">
                    {invitation.role}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {statusMessage ? (
        <div className="lg:col-span-3">
          <Card className="bg-card/85">
            <CardContent className="pt-6">
              <PageState
                eyebrow="Invite sent"
                title="Invitation saved"
                body={statusMessage}
                actions={
                  <a href="#invite-form" style={pageStateLinkStyle}>
                    Invite another teammate
                  </a>
                }
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
};
