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
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Owner" | "Member">("Member");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectClassName =
    "flex h-10 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      setIsSaving(true);
      setError(null);
      await createWorkspaceInvitation(workspaceSlug, {
        email: email.trim(),
        role
      });
      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setEmail("");
        setRole("Member");
      }, 1500);
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
            Send an email invitation to bring teammates into this workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@company.com"
              className="h-11 rounded-xl bg-background/50 border-border/60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSaving || success}
              required
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="role" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Workspace Role
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "Owner" | "Member")}
              className={selectClassName}
              disabled={isSaving || success}
            >
              <option value="Member">Member</option>
              <option value="Owner">Owner</option>
            </select>
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
            <Button type="submit" disabled={isSaving || success || !email.trim()} className="min-w-32 rounded-xl">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : success ? (
                "Sent!"
              ) : (
                "Send invite"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
