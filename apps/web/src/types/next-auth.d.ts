import type { DefaultSession } from "next-auth";
import type { WorkspaceRole, AuthProvider } from "@wevlo/contracts";

declare module "next-auth" {
  interface Session {
    userEmail: string;
    userName: string;
    userId: string;
    provider: AuthProvider;
    providerUserId: string;
    user: DefaultSession["user"] & {
      avatarUrl: string | null;
      defaultWorkspaceSlug: string | null;
      email: string | null;
      id: string;
      provider: AuthProvider;
      providerUserId: string;
      role: WorkspaceRole;
      workspaceSlugs: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    avatarUrl?: string | null;
    defaultWorkspaceSlug?: string | null;
    provider?: AuthProvider;
    providerUserId?: string;
    role?: WorkspaceRole;
    userId?: string;
    workspaceSlugs?: string[];
  }
}
