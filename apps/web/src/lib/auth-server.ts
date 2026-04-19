import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { buildLoginHref, sanitizeReturnPath, type Session as AppSession } from "@wevlo/auth";

import { authOptions } from "@/auth";

export const getCurrentAuthSession = async (): Promise<AppSession | null> => {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    defaultWorkspaceSlug: session.user.defaultWorkspaceSlug,
    issuedAt: new Date().toISOString(),
    provider: session.user.provider,
    providerUserId: session.user.providerUserId,
    role: session.user.role,
    userEmail: session.user.email ?? "",
    userId: session.user.id,
    userName: session.user.name ?? "Unknown user",
    workspaceSlugs: session.user.workspaceSlugs
  };
};

export const requireCurrentAuthSession = async (nextPath?: string): Promise<AppSession> => {
  const session = await getCurrentAuthSession();

  if (!session) {
    redirect(buildLoginHref(sanitizeReturnPath(nextPath)));
  }

  return session;
};
