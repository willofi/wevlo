import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      defaultWorkspaceSlug: string | null;
      email: string | null;
      id: string;
      provider: "dev" | "google";
      providerUserId: string;
      role: "Owner" | "Member";
      workspaceSlugs: string[];
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    defaultWorkspaceSlug?: string | null;
    provider?: "dev" | "google";
    providerUserId?: string;
    role?: "Owner" | "Member";
    userId?: string;
    workspaceSlugs?: string[];
  }
}
