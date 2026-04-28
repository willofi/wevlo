"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
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
      setError(null);

      const results = await Promise.allSettled(
        emails.map((email) =>
          createWorkspaceInvitation(workspaceSlug, {
            email,
            role: "Member"
          })
        )
      );

      const failures = results.filter((r) => r.status === "rejected");

      if (failures.length > 0) {
        setError(`${failures.length} invitation(s) failed. Please check the email addresses.`);
        if (failures.length < emails.length) {
          // Partial success
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
          setEmailInput("");
        }, 1500);
      }
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Invitation failed");
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
          {error ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-500">
              {error}
            </div>
          ) : null}
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving || success}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || success || !emailInput.trim()} className="min-w-32 rounded-xl">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : success ? (
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
