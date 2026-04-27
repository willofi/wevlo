"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Settings2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";

import {
  Avatar,
  AvatarFallback,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn
} from "@wevlo/ui-web";

type AccountMenuProps = {
  align?: "center" | "end" | "start" | undefined;
  email?: string | null | undefined;
  name: string;
  side?: "bottom" | "left" | "right" | "top" | undefined;
  trigger: "avatar" | "collapsed" | "sidebar";
};

const descriptionByTrigger: Record<AccountMenuProps["trigger"], string> = {
  avatar: "Open account menu",
  collapsed: "Open account menu",
  sidebar: "Open account menu"
};

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AccountMenu({
  align = "end",
  email,
  name,
  side = "bottom",
  trigger
}: AccountMenuProps) {
  const router = useRouter();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const initials = useMemo(() => initialsFromName(name), [name]);
  const secondaryLabel = email ?? "Authenticated session";

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
          {trigger === "sidebar" ? (
            <button
              type="button"
              aria-label={descriptionByTrigger[trigger]}
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-sidebar-foreground/5"
            >
              <Avatar className="size-8 bg-transparent">
                <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-sidebar-foreground">{name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{secondaryLabel}</div>
              </div>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={descriptionByTrigger[trigger]}
              className={cn(
                "inline-flex items-center justify-center transition-colors",
                trigger === "avatar"
                  ? "size-10 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
                  : "size-9 rounded-full bg-primary text-xs font-semibold text-primary-foreground hover:opacity-90"
              )}
              title={name}
            >
              {initials}
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          side={side}
          className={cn("min-w-[17rem]", trigger === "sidebar" && "w-[min(20rem,calc(100vw-2rem))]")}
        >
          <div className="px-2.5 py-2">
            <div className="truncate text-sm font-semibold text-foreground">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{secondaryLabel}</div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              router.push("/settings");
            }}
            className="flex items-center gap-2"
          >
            <Settings2 className="size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setIsSignOutDialogOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <LogOut className="size-4" />
            Logout
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
            <Button type="button" variant="outline" onClick={() => setIsSignOutDialogOpen(false)} disabled={isSigningOut}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut}>
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
