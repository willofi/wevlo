import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buildLoginHref, sanitizeReturnPath } from "@wevlo/auth";

import { AuthShell } from "@/components/auth-shell";
import {
  PageState,
  pageStateButtonClassName,
  pageStateLinkClassName
} from "@/components/page-state";
import { getCurrentAuthSession } from "@/lib/auth-server";
import { getWebApiBaseUrl } from "@/lib/env";
import { acceptWorkspaceInvitationByToken } from "@/lib/server-api";
import { workspaceInvitationSchema } from "@wevlo/contracts";

type InvitePageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

export default async function AcceptInvitePage({ params }: InvitePageProps) {
  const { inviteCode } = await params;
  const session = await getCurrentAuthSession();
  const invitePath = sanitizeReturnPath(`/invite/${inviteCode}`);
  const invitationResponse = await fetch(
    `${getWebApiBaseUrl()}/api/v1/workspace-invitations/${encodeURIComponent(inviteCode)}`,
    { cache: "no-store" }
  );
  const invitation = invitationResponse.ok
    ? workspaceInvitationSchema.parse(await invitationResponse.json())
    : null;

  if (!invitation) {
    notFound();
  }

  const isCompleted = invitation.status !== "pending";

  return (
    <AuthShell
      title="Accept invite"
      subtitle={invitation.projectId ? `Accept project access for ${invitation.role}.` : `Accept workspace access for ${invitation.role}.`}
      aside={
        <div className="grid gap-4">
          <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Invite workflow</div>
          <p className="m-0 text-sm leading-6 text-foreground">
            This route accepts a pending workspace invitation with your authenticated web session.
          </p>
        </div>
      }
    >
      <div className="grid gap-4">
        <PageState
          eyebrow="Invite details"
          title={isCompleted ? `Invite is ${invitation.status}` : "Ready to join"}
          tone={isCompleted ? "warning" : "neutral"}
          body={
            <>
              <p style={{ margin: 0 }}>
                {session
                  ? isCompleted
                    ? "This invitation is no longer pending. Ask the workspace owner for a fresh invite if you still need access."
                    : `You are signed in as ${session.userName}. Accepting will attach this account to the invite.`
                  : "Sign in first, then return here to accept the invite with your web session."}
              </p>
              <p style={{ margin: "10px 0 0" }}>
                Scope: {invitation.projectId ? `project ${invitation.projectId}` : `workspace ${invitation.workspaceId}`} · role {invitation.role}
              </p>
            </>
          }
          actions={
            session && !isCompleted ? (
              <form
                action={async () => {
                  "use server";
                  await acceptWorkspaceInvitationByToken(inviteCode);
                  redirect("/");
                }}
              >
                <button type="submit" className={pageStateButtonClassName}>
                  Accept invite
                </button>
              </form>
            ) : session ? (
              <Link href="/" className={pageStateButtonClassName}>
                Return home
              </Link>
            ) : (
              <Link href={buildLoginHref(invitePath)} className={pageStateButtonClassName}>
                Sign in to continue
              </Link>
            )
          }
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={pageStateLinkClassName}>
            Return home
          </Link>
          {!session ? (
            <Link href={buildLoginHref(invitePath)} className={pageStateLinkClassName}>
              Go to login
            </Link>
          ) : null}
        </div>
      </div>
    </AuthShell>
  );
}
