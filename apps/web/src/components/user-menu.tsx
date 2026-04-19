"use client";

import Link from "next/link";
import { LogOut, Settings2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@wevlo/ui-web";

type UserMenuProps = {
  email?: string | null | undefined;
  name: string;
};

export function UserMenu({ email, name }: UserMenuProps) {
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const initials = useMemo(
    () =>
      name
        .split(" ")
        .map((token) => token[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [name]
  );

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut({
        callbackUrl: "/login",
        redirect: true
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02]"
            aria-label={`${name} menu`}
            title={name}
          >
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          <div className="px-2.5 py-2">
            <div className="text-sm font-semibold text-foreground">{name}</div>
            <div className="text-xs text-muted-foreground">{email ?? "Workspace member"}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2">
              <Settings2 className="size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setIsSignOutDialogOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle>Sign out of WEVLO?</DialogTitle>
            <DialogDescription>
              You will return to the login screen in this tab. Unsaved edits on the current page may be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSignOutDialogOpen(false)} disabled={isSigningOut}>
              Cancel
            </Button>
            <Button onClick={() => void handleSignOut()} disabled={isSigningOut}>
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
