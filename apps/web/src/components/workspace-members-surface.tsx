"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceMemberDto
} from "@wevlo/contracts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@wevlo/ui-web";

import { PageState, pageStateButtonStyle, pageStateLinkStyle } from "@/components/page-state";
import {
  createWorkspaceInvitation,
  getInviteHref,
  getWorkspaceMemberHref
} from "@/lib/issue-hub-data";

type WorkspaceMembersSurfaceProps = {
  initialInvitations: WorkspaceInvitationDto[];
  initialMembers: WorkspaceMemberDto[];
  workspace: WorkspaceDto;
};

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export const WorkspaceMembersSurface = ({
  initialInvitations,
  initialMembers,
  workspace
}: WorkspaceMembersSurfaceProps) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceInvitationDto["role"]>("Member");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [members] = useState(initialMembers);

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
      const invitation = await createWorkspaceInvitation(workspace.slug, {
        email,
        role: role === "Owner" ? "Owner" : "Member"
      });
      setInvitations((current) => [invitation, ...current]);
      setEmail("");
      setRole("Member");
      setStatusMessage(`Invitation created for ${invitation.inviteeEmail ?? invitation.inviteeUserId ?? "the teammate"}.`);
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Invitation failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
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
            placeholder="name@company.com"
            type="email"
          />
          <select value={role} onChange={(event) => setRole(event.target.value as "Owner" | "Member")} className={selectClassName}>
            <option value="Member">Member</option>
            <option value="Owner">Owner</option>
          </select>
          <Button type="button" onClick={handleInvite} disabled={isSaving || email.length === 0}>
            {isSaving ? "Sending invite..." : "Send invitation"}
          </Button>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-card/85">
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
                <a href="#invite-form" style={pageStateButtonStyle}>
                  Invite someone
                </a>
              }
            />
          ) : (
            <div className="grid gap-3">
              {members.map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={getWorkspaceMemberHref(workspace.slug, member.userId)}
                      className="text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {member.user.name}
                    </Link>
                    <div className="mt-1 text-sm text-muted-foreground">{member.user.email ?? member.userId}</div>
                  </div>
                  <div className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs font-semibold text-foreground">
                    {member.role}
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
