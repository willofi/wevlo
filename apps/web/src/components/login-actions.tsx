"use client";

import { signIn } from "next-auth/react";

import type { DemoUser } from "@wevlo/auth";
import { Button } from "@wevlo/ui-web";

type LoginActionsProps = {
  callbackUrl: string;
  demoUsers: DemoUser[];
  isDevAuthEnabled: boolean;
  isGoogleEnabled: boolean;
};

export const LoginActions = ({
  callbackUrl,
  demoUsers,
  isDevAuthEnabled,
  isGoogleEnabled
}: LoginActionsProps) => {
  return (
    <div className="grid gap-4">
      {isGoogleEnabled ? (
        <Button
          type="button"
          className="h-12 w-full justify-between rounded-2xl px-5 text-base"
          onClick={() => void signIn("google", { callbackUrl })}
        >
          Continue with Google
        </Button>
      ) : (
        <div className="rounded-xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-muted-foreground">
          Google OAuth is not configured yet. Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` to enable it.
        </div>
      )}
      {isDevAuthEnabled ? (
        <div className="grid gap-3">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Development identities</div>
          {demoUsers.map((user) => (
            <Button
              key={user.id}
              type="button"
              variant="outline"
              className="h-auto w-full justify-between rounded-2xl border-border/80 bg-background/65 px-4 py-4 text-left text-base hover:bg-secondary/75"
              onClick={() => void signIn("credentials", { callbackUrl, userId: user.id })}
            >
              <span>Continue as {user.name}</span>
              <span className="text-sm font-medium text-muted-foreground">{user.role}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
