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
import type { WorkspaceInvitationResult } from "@wevlo/contracts";

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
        notifySuccess("Invitations sent.");
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
          setEmailInput("");
        }, 1500);
      } else {
        const failureSummary = failures.slice(0, 3).map(describeInviteFailure).join(" / ");
        const hasMore = failures.length > 3 ? ` (+${failures.length - 3} more)` : "";
        notifyError(new Error(`${failures.length} invitation(s) failed: ${failureSummary}${hasMore}`), "Invitation failed.");
        if (failures.length < results.length) {
          notifySuccess("Some invitations were sent.");
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        }
      }
    } catch (inviteError) {
      notifyError(inviteError, "Invitation failed.");
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
            Enter email addresses separated by commas to bring teammates into this workspace.
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
            New members will be invited with the "Member" role by default. Roles can be changed later in workspace settings.
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving || success}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || success || !emailInput.trim()} className="min-w-32 rounded-xl">
              {isSaving ? "Sending..." : success ? (
                "Sent!"
              ) : (
                "Send invites"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
