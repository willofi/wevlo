import Link from "next/link";
import { redirect } from "next/navigation";

import { demoUsers, sanitizeReturnPath } from "@wevlo/auth";
import { Button } from "@wevlo/ui-web";

import { AuthShell } from "@/components/auth-shell";
import { LoginActions } from "@/components/login-actions";
import { getCurrentAuthSession } from "@/lib/auth-server";
import { isDevAuthEnabled, isGoogleOAuthConfigured } from "@/lib/runtime-env";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const session = await getCurrentAuthSession();
  const callbackUrl = sanitizeReturnPath(next);

  if (session) {
    redirect(callbackUrl);
  }

  const isDevEnabled = isDevAuthEnabled();
  const isGoogleEnabled = isGoogleOAuthConfigured();

  return (
    <AuthShell
      title="Sign in"
      subtitle="Sign in to open the protected web shell and route API traffic through the authenticated BFF."
      aside={
        <div className="grid gap-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">What happens next</div>
          <p className="m-0 text-sm leading-6 text-foreground">
            The session cookie is issued by the web app, the BFF forwards your identity to the API, and protected routes
            stay behind login.
          </p>
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link href="/invite/demo-invite">Review invite flow</Link>
          </Button>
        </div>
      }
    >
      <LoginActions
        callbackUrl={callbackUrl}
        demoUsers={demoUsers}
        isDevAuthEnabled={isDevEnabled}
        isGoogleEnabled={isGoogleEnabled}
      />
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        The session is issued by Auth.js and the web BFF forwards authenticated user context to the API.
      </p>
    </AuthShell>
  );
}
