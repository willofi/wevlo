"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type {
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
  WorkspaceRole
} from "@wevlo/contracts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, cn, Input } from "@wevlo/ui-web";

import { PageState, pageStateButtonStyle } from "@/components/page-state";
import { notifyError, notifySuccess } from "@/lib/action-feedback";
import {
  createWorkspaceInvitation,
  getWorkspaceInvitationFailureMessage,
  getInviteHref,
  getWorkspaceMemberHref,
  removeWorkspaceMember,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
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

const canManageRole = (
  currentUserRole: WorkspaceRole,
  targetRole: WorkspaceRole
): boolean => currentUserRole === "Owner" || roleHierarchy[targetRole] > roleHierarchy[currentUserRole];

export const WorkspaceMembersSurface = ({
  initialInvitations,
  initialMembers,
  workspace,
  currentUser
}: WorkspaceMembersSurfaceProps) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("Member");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [members, setMembers] = useState(initialMembers);

  const currentUserMembership = useMemo(
    () => members.find((m) => m.userId === currentUser.id),
    [members, currentUser.id]
  );

  const currentUserRole = currentUserMembership?.role ?? "Guest";
  const isOwner = currentUserRole === "Owner";
  const canInvite = currentUserRole === "Owner" || currentUserRole === "Maintainer";
  const isBusy = busyAction !== null;

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending" || invitation.status === "delivery_failed"),
    [invitations]
  );

  const completedInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status !== "pending" && invitation.status !== "delivery_failed"),
    [invitations]
  );

  const handleInvite = async () => {
    try {
      setBusyAction("invite");
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
      const alreadyPendingCount = failures.filter((result) => result.reason === "invite_already_pending").length;
      const deliveryFailedCount = failures.filter((result) => result.reason === "email_send_failed").length;

      if (failedCount > 0) {
        const failureSummary = failures.slice(0, 3).map(getWorkspaceInvitationFailureMessage).join(" / ");
        const hasMore = failures.length > 3 ? ` (+${failures.length - 3} more)` : "";
        notifyError(new Error(`${failureSummary}${hasMore}`), "일부 초대 처리에 실패했어요.");
      }

      setEmail("");
      setRole("Member");
      notifySuccess(
        `초대 생성 ${createdCount}건, 이미 멤버 ${alreadyMemberCount}건, 실패 ${failedCount}건${
          alreadyPendingCount > 0 ? ` (이미 대기 중 ${alreadyPendingCount}건 포함)` : ""
        }${
          deliveryFailedCount > 0 ? ` (메일 발송 실패 ${deliveryFailedCount}건 포함)` : ""
        }.`
      );
      setInvitations((current) => [
        ...current,
        ...results
          .filter((result) => result.invitationId && result.status !== "already_member" && result.reason !== "invite_already_pending")
          .map((result): WorkspaceInvitationDto => {
            const status: WorkspaceInvitationDto["status"] =
              result.reason === "email_send_failed" ? "delivery_failed" : "pending";
            return {
              id: result.invitationId!,
              workspaceId: workspace.id,
              projectId: null,
              inviteeUserId: null,
              inviteeEmail: result.email,
              role,
              status,
              invitedByUserId: currentUser.id,
              acceptedByUserId: null,
              acceptedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              acceptToken: result.invitationId,
              sendAttemptCount: 1,
              lastSendError: result.reason === "email_send_failed" ? "email_send_failed" : null
            };
          })
      ]);
    } catch (inviteError) {
      notifyError(inviteError, "초대 생성에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      setBusyAction(`resend:${invitationId}`);
      const updated = await resendWorkspaceInvitation(workspace.slug, invitationId);
      setInvitations((current) => current.map((item) => (item.id === invitationId ? updated : item)));
      notifySuccess("초대 메일을 다시 보냈어요.");
    } catch (resendError) {
      notifyError(resendError, "초대 재전송에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      setBusyAction(`revoke:${invitationId}`);
      await revokeWorkspaceInvitation(workspace.slug, invitationId);
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitationId
            ? {
                ...item,
                status: "revoked",
                updatedAt: new Date().toISOString(),
                acceptToken: null
              }
            : item
        )
      );
      notifySuccess("초대를 취소했어요.");
    } catch (revokeError) {
      notifyError(revokeError, "초대 취소에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: WorkspaceRole) => {
    try {
      setBusyAction(`role:${userId}`);
      const updatedMember = await updateWorkspaceMember(workspace.slug, userId, { role: newRole });
      setMembers((current) => current.map((m) => (m.userId === userId ? updatedMember : m)));
      notifySuccess("멤버 권한을 변경했어요.");
    } catch (updateError) {
      notifyError(updateError, "권한 변경에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("이 멤버를 워크스페이스에서 내보낼까요?")) {
      return;
    }

    try {
      setBusyAction(`remove:${userId}`);
      await removeWorkspaceMember(workspace.slug, userId);
      setMembers((current) => current.filter((m) => m.userId !== userId));
      notifySuccess("워크스페이스에서 멤버를 내보냈어요.");
    } catch (removeError) {
      notifyError(removeError, "멤버 내보내기에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {canInvite && (
        <Card id="invite-form" className="bg-card/85">
          <CardHeader>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Invite teammate</div>
            <CardTitle>워크스페이스 초대</CardTitle>
            <CardDescription>
              프로젝트 권한을 주기 전에 먼저 {workspace.name} 워크스페이스에 멤버를 초대하세요.
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
            <Button type="button" onClick={handleInvite} disabled={isBusy || email.length === 0}>
              {busyAction === "invite" ? "초대 보내는 중..." : "초대 보내기"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!canInvite ? (
        <Card className="bg-card/85">
          <CardHeader>
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workspace permissions</div>
            <CardTitle>읽기 전용 멤버 보기</CardTitle>
            <CardDescription>
              현재 권한은 <span className="font-semibold text-foreground">{currentUserRole}</span> 입니다. 멤버와 권한은 볼 수 있지만,
              초대, 권한 변경, 멤버 내보내기는 Owner 또는 Maintainer만 할 수 있어요.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card className={cn("bg-card/85", !canInvite && "lg:col-span-2")}>
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workspace members</div>
          <CardTitle>활성 멤버 {members.length}명</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <PageState
              eyebrow="No members yet"
              title="첫 멤버를 초대해 보세요"
              body="아직 이 워크스페이스에 멤버가 없어요. 팀이 함께 작업할 수 있도록 초대를 보내세요."
              actions={
                isOwner ? (
                  <a href="#invite-form" style={pageStateButtonStyle}>
                    멤버 초대
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
                      canInvite && canManageRole(currentUserRole, member.role) ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) => void handleUpdateRole(member.userId, e.target.value as WorkspaceRole)}
                          className={cn(selectClassName, "h-8 w-32 text-[11px] py-0")}
                          disabled={isBusy}
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
                          disabled={isBusy}
                        >
                          내보내기
                        </Button>
                      </>
                      ) : (
                        <div className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
                          {member.role}
                        </div>
                      )
                    ) : (
                      <div className="shrink-0 rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
                        {member.role} (나)
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
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Invitations</div>
          <CardTitle>대기 중 초대 {pendingInvitations.length}건</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length === 0 ? (
            <PageState
              eyebrow="Nothing pending"
              title="대기 중인 초대가 없어요"
              body="초대를 보내면 수락 링크와 만료일이 여기에 표시돼요."
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
                      {invitation.role} · {invitation.status} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canInvite ? (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <a href={getInviteHref(invitation.acceptToken ?? invitation.id)}>초대 열기</a>
                        </Button>
                        <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={() => void handleResendInvitation(invitation.id)}>
                          {busyAction === `resend:${invitation.id}` ? "재전송 중..." : "재전송"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => void handleRevokeInvitation(invitation.id)}>
                          {busyAction === `revoke:${invitation.id}` ? "취소 중..." : "취소"}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/85 lg:col-span-2">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">History</div>
          <CardTitle>최근 초대 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {completedInvitations.length === 0 ? (
            <PageState
              eyebrow="No history yet"
              title="아직 초대 이력이 없어요"
              body="수락되었거나 취소된 초대는 여기서 확인할 수 있어요."
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

    </div>
  );
};
