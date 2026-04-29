"use client";

import { useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from "@wevlo/ui-web";
import { createWorkspaceInvitation } from "@/lib/issue-hub-data";
import { notifyError, notifySuccess } from "@/lib/action-feedback";
import { getWorkspaceInvitationFailureMessage } from "@/lib/issue-hub-data";

export function InviteMemberDialog({
  workspaceSlug,
  open,
  onOpenChange
}: {
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = emailInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (emails.length === 0) return;

    try {
      setIsSaving(true);
      const results = await createWorkspaceInvitation(workspaceSlug, {
        emails,
        role: "Member"
      });
      const failures = results.filter((result) => result.status === "failed");

      if (failures.length === 0) {
        notifySuccess("초대를 보냈어요.");
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
          setEmailInput("");
        }, 1500);
      } else {
        const failureSummary = failures.slice(0, 3).map(getWorkspaceInvitationFailureMessage).join(" / ");
        const hasMore = failures.length > 3 ? ` (+${failures.length - 3} more)` : "";
        notifyError(new Error(`${failureSummary}${hasMore}`), "일부 초대 처리에 실패했어요.");
        if (failures.length < results.length) {
          notifySuccess("일부 초대는 정상적으로 보냈어요.");
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        }
      }
    } catch (inviteError) {
      notifyError(inviteError, "초대 생성에 실패했어요.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/40 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">Invite to your workspace</DialogTitle>
          <DialogDescription>
            쉼표로 구분한 이메일 주소를 입력해 워크스페이스에 팀원을 초대하세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="emails" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Email addresses (comma separated)
            </label>
            <Input
              id="emails"
              type="text"
              placeholder="jane@company.com, john@company.com"
              className="h-11 rounded-xl bg-background/50 border-border/60"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              disabled={isSaving || success}
              required
            />
          </div>
          <div className="text-[11px] text-muted-foreground/60 italic">
            새 멤버는 기본적으로 "Member" 권한으로 초대되며, 이후 워크스페이스 설정에서 변경할 수 있어요.
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving || success}>
              취소
            </Button>
            <Button type="submit" disabled={isSaving || success || !emailInput.trim()} className="min-w-32 rounded-xl">
              {isSaving ? "보내는 중..." : success ? (
                "완료!"
              ) : (
                "초대 보내기"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
