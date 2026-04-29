"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import type { WorkspaceRole } from "@wevlo/contracts";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wevlo/ui-web";

import { notifyError, notifySuccess } from "@/lib/action-feedback";
import {
  createWorkspaceInvitation,
  getInviteHref,
  getWorkspaceInvitationFailureMessage,
  removeWorkspaceMember,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  updateWorkspaceMember
} from "@/lib/issue-hub-data";

export type WorkspaceSettingsCapabilities = {
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canViewMembers: boolean;
};

export type WorkspaceSettingsMemberRow = {
  assignableRoles: WorkspaceRole[];
  email: string | null;
  isCurrentUser: boolean;
  isEditableByCurrentUser: boolean;
  isRemovableByCurrentUser: boolean;
  name: string;
  role: WorkspaceRole;
  status: "Active";
  userId: string;
};

export type WorkspaceSettingsPendingInviteRow = {
  email: string;
  id: string;
  inviteHref: string;
  role: WorkspaceRole;
  status: "Delivery failed" | "Invited";
};

export type WorkspaceSettingsSectionData = {
  capabilities: WorkspaceSettingsCapabilities;
  currentUserRole: WorkspaceRole;
  members: WorkspaceSettingsMemberRow[];
  pendingInvites: WorkspaceSettingsPendingInviteRow[];
  selectedWorkspace: {
    id: string;
    name: string;
    slug: string;
  };
};

const workspaceRoles: WorkspaceRole[] = ["Owner", "Maintainer", "Member", "Developer", "Guest"];

export function WorkspaceMembersSettingsSection({
  data
}: {
  data: WorkspaceSettingsSectionData;
}) {
  const [members, setMembers] = useState(data.members);
  const [pendingInvites, setPendingInvites] = useState(data.pendingInvites);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("Member");

  const handleUpdateRole = async (userId: string, role: WorkspaceRole) => {
    try {
      setBusyAction(`role:${userId}`);
      const updated = await updateWorkspaceMember(data.selectedWorkspace.slug, userId, { role });
      setMembers((current) =>
        current.map((member) =>
          member.userId === userId
            ? {
                ...member,
                email: updated.user.email,
                name: updated.user.name,
                role: updated.role
              }
            : member
        )
      );
      notifySuccess("멤버 권한을 변경했어요.");
    } catch (error) {
      notifyError(error, "권한 변경에 실패했어요.");
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
      await removeWorkspaceMember(data.selectedWorkspace.slug, userId);
      setMembers((current) => current.filter((member) => member.userId !== userId));
      notifySuccess("워크스페이스에서 멤버를 내보냈어요.");
    } catch (error) {
      notifyError(error, "멤버 내보내기에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleInvite = async () => {
    const emails = inviteEmails
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (emails.length === 0) {
      return;
    }

    try {
      setBusyAction("invite");
      const results = await createWorkspaceInvitation(data.selectedWorkspace.slug, {
        emails,
        role: inviteRole
      });
      const failures = results.filter((result) => result.status === "failed");

      if (failures.length > 0) {
        const failureSummary = failures.slice(0, 3).map(getWorkspaceInvitationFailureMessage).join(" / ");
        const hasMore = failures.length > 3 ? ` (+${failures.length - 3} more)` : "";
        notifyError(new Error(`${failureSummary}${hasMore}`), "일부 초대 처리에 실패했어요.");
      }

      const nextInvites = results
        .filter((result) => result.invitationId && result.status !== "already_member" && result.reason !== "invite_already_pending")
        .map((result): WorkspaceSettingsPendingInviteRow => ({
          email: result.email,
          id: result.invitationId!,
          inviteHref: getInviteHref(result.invitationId!),
          role: inviteRole,
          status: result.reason === "email_send_failed" ? "Delivery failed" : "Invited"
        }));

      if (nextInvites.length > 0) {
        setPendingInvites((current) => [...nextInvites, ...current]);
      }

      setInviteEmails("");
      setInviteRole("Member");
      notifySuccess("초대 요청을 처리했어요.");
    } catch (error) {
      notifyError(error, "초대 생성에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    try {
      setBusyAction(`resend:${invitationId}`);
      const updated = await resendWorkspaceInvitation(data.selectedWorkspace.slug, invitationId);
      setPendingInvites((current) =>
        current.map((invite) =>
          invite.id === invitationId
            ? {
                ...invite,
                inviteHref: getInviteHref(updated.acceptToken ?? updated.id),
                status: updated.status === "delivery_failed" ? "Delivery failed" : "Invited"
              }
            : invite
        )
      );
      notifySuccess("초대 메일을 다시 보냈어요.");
    } catch (error) {
      notifyError(error, "초대 재전송에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    try {
      setBusyAction(`revoke:${invitationId}`);
      await revokeWorkspaceInvitation(data.selectedWorkspace.slug, invitationId);
      setPendingInvites((current) => current.filter((invite) => invite.id !== invitationId));
      notifySuccess("초대를 취소했어요.");
    } catch (error) {
      notifyError(error, "초대 취소에 실패했어요.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Members</div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{data.selectedWorkspace.name}</h2>
        <p className="text-sm text-muted-foreground">
          현재 권한: <span className="font-medium text-foreground">{data.currentUserRole}</span>
        </p>
      </div>

      <Card className="rounded-[24px] border-border/70 shadow-none">
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="px-5 py-8 text-sm text-muted-foreground">이 워크스페이스에 멤버가 없어요.</div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-12 px-5">이름</TableHead>
                      <TableHead className="h-12">이메일</TableHead>
                      <TableHead className="h-12">역할</TableHead>
                      <TableHead className="h-12">상태</TableHead>
                      <TableHead className="h-12 px-5 text-right">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.userId}>
                        <TableCell className="px-5 py-4 font-medium text-foreground">
                          {member.name} {member.isCurrentUser ? <span className="text-muted-foreground">(You)</span> : null}
                        </TableCell>
                        <TableCell className="py-4 text-muted-foreground">{member.email ?? "No email"}</TableCell>
                        <TableCell className="py-4">
                          {member.isEditableByCurrentUser ? (
                            <Select
                              value={member.role}
                              onValueChange={(role) => void handleUpdateRole(member.userId, role as WorkspaceRole)}
                              disabled={busyAction !== null}
                            >
                              <SelectTrigger className="h-10 w-[156px] rounded-xl bg-background/70">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {member.assignableRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="inline-flex rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs font-medium text-foreground">
                              {member.role}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="inline-flex rounded-full border border-border/70 bg-secondary/30 px-3 py-1 text-xs font-medium text-foreground">
                            {member.status}
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-right">
                          {member.isRemovableByCurrentUser ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => void handleRemoveMember(member.userId)}
                                >
                                  내보내기
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y divide-border/50 md:hidden">
                {members.map((member) => (
                  <div key={member.userId} className="space-y-4 px-5 py-4">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">이름</div>
                      <div className="text-sm font-semibold text-foreground">
                        {member.name} {member.isCurrentUser ? <span className="text-muted-foreground">(You)</span> : null}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">이메일</div>
                      <div className="text-sm text-muted-foreground">{member.email ?? "No email"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">역할</div>
                      {member.isEditableByCurrentUser ? (
                        <Select
                          value={member.role}
                          onValueChange={(role) => void handleUpdateRole(member.userId, role as WorkspaceRole)}
                          disabled={busyAction !== null}
                        >
                          <SelectTrigger className="rounded-xl bg-background/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {member.assignableRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="inline-flex rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs font-medium text-foreground">
                          {member.role}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex rounded-full border border-border/70 bg-secondary/30 px-3 py-1 text-xs font-medium text-foreground">
                        {member.status}
                      </div>
                      {member.isRemovableByCurrentUser ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={busyAction !== null}
                          onClick={() => void handleRemoveMember(member.userId)}
                        >
                          내보내기
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {data.capabilities.canInviteMembers ? (
        <Card className="rounded-[24px] border-border/70 shadow-none">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
              <Input
                value={inviteEmails}
                onChange={(event) => setInviteEmails(event.target.value)}
                placeholder="name@company.com, teammate@company.com"
                className="h-11 rounded-2xl"
              />
              <Select
                value={inviteRole}
                onValueChange={(role) => setInviteRole(role as WorkspaceRole)}
                disabled={busyAction !== null}
              >
                <SelectTrigger className="h-11 rounded-2xl bg-background/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaceRoles
                    .filter((role) => role !== "Owner")
                    .map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                className="h-11 rounded-2xl px-5"
                onClick={() => void handleInvite()}
                disabled={busyAction !== null || inviteEmails.trim().length === 0}
              >
                {busyAction === "invite" ? "초대 중..." : "초대"}
              </Button>
            </div>

            <div className="space-y-2.5">
              {pendingInvites.length === 0 ? (
                <div className="text-sm text-muted-foreground">대기 중인 초대가 없어요.</div>
              ) : (
                pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{invite.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {invite.role} · {invite.status}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={invite.inviteHref}>열기</a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyAction !== null}
                        onClick={() => void handleResendInvite(invite.id)}
                      >
                        {busyAction === `resend:${invite.id}` ? "재전송 중..." : "재전송"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyAction !== null}
                        onClick={() => void handleRevokeInvite(invite.id)}
                      >
                        {busyAction === `revoke:${invite.id}` ? "취소 중..." : "취소"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
