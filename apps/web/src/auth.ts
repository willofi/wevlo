import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";

import type { WorkspaceRole } from "@wevlo/contracts";
import { getDemoUser, sanitizeReturnPath } from "@wevlo/auth";
import {
  getAuthSecret,
  isDevAuthEnabled,
  isEmailAuthConfigured,
  isGoogleOAuthConfigured
} from "@/lib/env";
import {
  consumeInternalVerificationToken,
  createInternalAuthUser,
  getInternalAuthUserByEmail,
  getInternalAuthUserById,
  WevloAuthAdapter
} from "@/lib/auth-adapter";

const devAuthEnabled = isDevAuthEnabled();
const emailAuthConfigured = isEmailAuthConfigured();

const providers: NextAuthOptions["providers"] = [];
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (emailAuthConfigured) {
  providers.push(
    EmailProvider({
      from: process.env.EMAIL_FROM ?? "noreply@wevlo.io",
      // This is unused because delivery is handled by Resend directly.
      server: "smtp://localhost:1025",
      async sendVerificationRequest({ identifier, provider, url }) {
        if (!resend) {
          throw new Error("RESEND_API_KEY is not configured");
        }

        const response = await resend.emails.send({
          from: provider.from as string,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
              <p>Sign in to Wevlo by clicking the link below.</p>
              <p><a href="${url}">Continue to Wevlo</a></p>
              <p style="font-size: 12px; color: #6b7280;">If you did not request this email, you can ignore it.</p>
            </div>
          `,
          subject: "Sign in to Wevlo",
          to: identifier
        });

        if (response.error) {
          throw new Error(response.error.message);
        }
      }
    })
  );
}

if (isGoogleOAuthConfigured()) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!
    })
  );
}

if (emailAuthConfigured) {
  providers.push(
    Credentials({
      credentials: {
        code: {
          label: "Code",
          type: "text"
        },
        email: {
          label: "Email",
          type: "email"
        }
      },
      async authorize(credentials) {
        const normalizedEmail = typeof credentials?.email === "string"
          ? credentials.email.trim().toLowerCase()
          : "";
        const code = typeof credentials?.code === "string" ? credentials.code.trim() : "";

        if (!normalizedEmail || !/^\d{6}$/.test(code)) {
          return null;
        }

        const consumed = await consumeInternalVerificationToken({
          identifier: `otp:${normalizedEmail}`,
          token: code
        });

        if (!consumed) {
          return null;
        }

        const user =
          await getInternalAuthUserByEmail(normalizedEmail)
          ?? await createInternalAuthUser({
            email: normalizedEmail,
            ...(normalizedEmail.includes("@") ? { name: normalizedEmail.split("@")[0] } : {})
          });

        if (!user) {
          return null;
        }

        return {
          defaultWorkspaceSlug: null,
          email: user.email,
          id: user.id,
          name: user.name,
          provider: "email",
          providerUserId: normalizedEmail,
          role: "Member" as WorkspaceRole,
          workspaceSlugs: []
        };
      },
      id: "email-otp",
      name: "Email OTP"
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
  adapter: WevloAuthAdapter(),
  callbacks: {
    async jwt({ account, token, user }) {
      if (account && user) {
        const providerAvatarUrl =
          typeof (user as { image?: string | null }).image === "string"
            ? (user as { image?: string | null }).image ?? null
            : null;
        token.defaultWorkspaceSlug = (user as { defaultWorkspaceSlug?: string | null }).defaultWorkspaceSlug ?? null;
        token.avatarUrl = providerAvatarUrl ?? token.avatarUrl ?? null;
        token.email = user.email ?? null;
        token.name = user.name ?? null;
        if (account.provider === "credentials") {
          token.provider = (user as { provider?: "dev" | "email" }).provider ?? "dev";
        } else {
          token.provider = account.provider === "email" ? "email" : "google";
        }
        token.providerUserId = account.providerAccountId
          ?? (user as { providerUserId?: string }).providerUserId
          ?? String(user.id);
        token.role = (user as { role?: WorkspaceRole }).role ?? "Member";
        token.userId = String(user.id);
        token.workspaceSlugs = (user as { workspaceSlugs?: string[] }).workspaceSlugs ?? [];
      }

      if ((!token.email || !token.name || !token.avatarUrl) && typeof token.sub === "string") {
        const hydratedUser = await getInternalAuthUserById(token.sub);

        if (hydratedUser) {
          token.avatarUrl = hydratedUser.avatarUrl ?? token.avatarUrl ?? null;
          token.email = hydratedUser.email ?? token.email ?? null;
          token.name = hydratedUser.name ?? token.name ?? null;

          if (!token.providerUserId) {
            const matchingIdentity = hydratedUser.identities.find((identity) => identity.provider === token.provider);
            if (matchingIdentity?.providerUserId) {
              token.providerUserId = matchingIdentity.providerUserId;
            }
          }
        }
      }

      if (token.provider === "email" && !token.providerUserId && typeof token.email === "string") {
        token.providerUserId = token.email;
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
      session.user.avatarUrl = typeof token.avatarUrl === "string" ? token.avatarUrl : null;
      session.user.email = typeof token.email === "string" ? token.email : null;
      session.user.id = typeof token.userId === "string" ? token.userId : String(token.sub ?? "");
      session.user.name = typeof token.name === "string" ? token.name : "";
      session.user.provider = (token.provider as any) ?? "dev";
      session.user.providerUserId =
        typeof token.providerUserId === "string" ? token.providerUserId : session.user.id;
      session.user.role = (token.role as WorkspaceRole) ?? "Member";
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
  cookies: {
    sessionToken: {
      name: "wevlo.next-auth.session-token",
      options: {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      }
    }
  },
  session: {
    strategy: "jwt"
  }
};
