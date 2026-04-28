import type { AuthProvider, WorkspaceRole } from "@wevlo/contracts";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  workspaceSlugs: string[];
  defaultWorkspaceSlug: string | null;
};

export type Session = {
  userId: string;
  userName: string;
  userEmail: string;
  provider: AuthProvider;
  providerUserId: string;
  role: DemoUser["role"];
  workspaceSlugs: string[];
  defaultWorkspaceSlug: string | null;
  issuedAt: string;
};

export type InternalAuthHeaders = {
  "x-wevlo-internal-token": string;
  "x-wevlo-auth-provider": AuthProvider;
  "x-wevlo-provider-user-id": string;
  "x-wevlo-user-email": string;
  "x-wevlo-user-id": string;
  "x-wevlo-user-name": string;
};

export const demoUsers: DemoUser[] = [
  {
    id: "user_demo_owner",
    name: "Demo Owner",
    email: "owner@wevlo.local",
    role: "Owner",
    workspaceSlugs: [],
    defaultWorkspaceSlug: null
  },
  {
    id: "user-ava",
    name: "Ava Chen",
    email: "ava@wevlo.local",
    role: "Member",
    workspaceSlugs: [],
    defaultWorkspaceSlug: null
  },
  {
    id: "user-noah",
    name: "Noah Patel",
    email: "noah@wevlo.local",
    role: "Member",
    workspaceSlugs: [],
    defaultWorkspaceSlug: null
  },
  {
    id: "user-kim",
    name: "Kim Alvarez",
    email: "kim@wevlo.local",
    role: "Member",
    workspaceSlugs: [],
    defaultWorkspaceSlug: null
  },
  {
    id: "user-lucas",
    name: "Lucas Martin",
    email: "lucas@wevlo.local",
    role: "Member",
    workspaceSlugs: [],
    defaultWorkspaceSlug: null
  }
];

export const getDemoUser = (userId: string): DemoUser | undefined => {
  return demoUsers.find((user) => user.id === userId);
};

export const buildInternalAuthHeaders = (
  session: Pick<Session, "provider" | "providerUserId" | "userEmail" | "userId" | "userName">,
  internalToken: string
): InternalAuthHeaders => ({
  "x-wevlo-auth-provider": session.provider,
  "x-wevlo-internal-token": internalToken,
  "x-wevlo-provider-user-id": session.providerUserId,
  "x-wevlo-user-email": session.userEmail,
  "x-wevlo-user-id": session.userId,
  "x-wevlo-user-name": session.userName
});

export const isWorkspaceVisible = (session: Pick<Session, "workspaceSlugs">, workspaceSlug: string): boolean => {
  return session.workspaceSlugs.includes(workspaceSlug);
};

export const sanitizeReturnPath = (nextPath?: string | null): string => {
  if (!nextPath) {
    return "/";
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
};

export const buildLoginHref = (nextPath?: string | null): string => {
  const sanitized = sanitizeReturnPath(nextPath);
  return sanitized === "/" ? "/login" : `/login?next=${encodeURIComponent(sanitized)}`;
};
