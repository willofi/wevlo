import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { getDemoUser, sanitizeReturnPath } from "@wevlo/auth";
import { getAuthSecret, isDevAuthEnabled, isGoogleOAuthConfigured } from "@/lib/runtime-env";

const devAuthEnabled = isDevAuthEnabled();

const providers: NextAuthOptions["providers"] = [];

if (isGoogleOAuthConfigured()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!
    })
  );
}

if (devAuthEnabled) {
  providers.push(
    Credentials({
      credentials: {
        userId: {
          label: "User ID",
          type: "text"
        }
      },
      authorize(credentials) {
        const userId = typeof credentials?.userId === "string" ? credentials.userId : "";
        const demoUser = getDemoUser(userId);

        if (!demoUser) {
          return null;
        }

        return {
          defaultWorkspaceSlug: demoUser.defaultWorkspaceSlug,
          email: demoUser.email,
          id: demoUser.id,
          name: demoUser.name,
          provider: "dev",
          providerUserId: demoUser.id,
          role: demoUser.role,
          workspaceSlugs: demoUser.workspaceSlugs
        };
      },
      id: "credentials",
      name: "Demo"
    })
  );
}

export const authOptions: NextAuthOptions = {
  callbacks: {
    jwt({ account, token, user }) {
      if (account && user) {
        token.defaultWorkspaceSlug = (user as { defaultWorkspaceSlug?: string | null }).defaultWorkspaceSlug ?? null;
        token.email = user.email ?? null;
        token.name = user.name ?? null;
        token.provider = account.provider === "credentials" ? "dev" : "google";
        token.providerUserId = account.providerAccountId
          ?? (user as { providerUserId?: string }).providerUserId
          ?? String(user.id);
        token.role = (user as { role?: "Owner" | "Member" }).role ?? "Member";
        token.userId = String(user.id);
        token.workspaceSlugs = (user as { workspaceSlugs?: string[] }).workspaceSlugs ?? [];
      }

      return token;
    },
    redirect({ baseUrl, url }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${sanitizeReturnPath(url)}`;
      }

      try {
        const parsed = new URL(url);

        if (parsed.origin === baseUrl) {
          return url;
        }
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
    session({ session, token }) {
      session.user.defaultWorkspaceSlug =
        typeof token.defaultWorkspaceSlug === "string" ? token.defaultWorkspaceSlug : null;
      session.user.email = typeof token.email === "string" ? token.email : null;
      session.user.id = typeof token.userId === "string" ? token.userId : String(token.sub ?? "");
      session.user.name = typeof token.name === "string" ? token.name : "Unknown user";
      session.user.provider = token.provider === "google" ? "google" : "dev";
      session.user.providerUserId =
        typeof token.providerUserId === "string" ? token.providerUserId : session.user.id;
      session.user.role = token.role === "Owner" ? "Owner" : "Member";
      session.user.workspaceSlugs = Array.isArray(token.workspaceSlugs)
        ? token.workspaceSlugs.filter((value): value is string => typeof value === "string")
        : [];

      // These are used by buildApiInternalAuthHeaders
      session.userEmail = session.user.email ?? "";
      session.userName = session.user.name;
      session.userId = session.user.id;
      session.provider = session.user.provider;
      session.providerUserId = session.user.providerUserId;

      return session;
    }
  },
  pages: {
    signIn: "/login"
  },
  providers,
  secret: getAuthSecret(),
  session: {
    strategy: "jwt"
  }
};
