import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";
import { getInternalAuthToken, getWebApiBaseUrl } from "@/lib/env";
import type { UserDto, VerificationTokenDto } from "@wevlo/contracts";

async function internalApiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const apiBaseUrl = getWebApiBaseUrl();
  const internalToken = getInternalAuthToken();

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-wevlo-internal-auth-token": internalToken,
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    console.error(`Internal Auth API error: ${response.status} ${message}`);
    return null;
  }

  return response.json() as Promise<T>;
}

function mapToAdapterUser(user: UserDto): AdapterUser {
  return {
    id: user.id,
    email: user.email!,
    name: user.name,
    emailVerified: null // Standard for magic links before first click
  };
}

export async function getInternalAuthUserById(id: string): Promise<UserDto | null> {
  return internalApiFetch<UserDto>(`/internal/auth/users/${encodeURIComponent(id)}`);
}

export async function getInternalAuthUserByEmail(email: string): Promise<UserDto | null> {
  return internalApiFetch<UserDto>(`/internal/auth/users/by-email/${encodeURIComponent(email)}`);
}

export function WevloAuthAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      const created = await internalApiFetch<UserDto>("/internal/auth/users", {
        method: "POST",
        body: JSON.stringify({
          email: user.email,
          name: user.name ?? undefined
        })
      });

      if (!created) {
        throw new Error("Failed to create user via internal API");
      }

      return mapToAdapterUser(created);
    },

    async getUser(_id: string) {
      const user = await getInternalAuthUserById(_id);
      return user ? mapToAdapterUser(user) : null;
    },

    async getUserByEmail(email: string) {
      const user = await getInternalAuthUserByEmail(email);
      return user ? mapToAdapterUser(user) : null;
    },

    async getUserByAccount({ provider, providerAccountId }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
      const user = await internalApiFetch<UserDto>(
        `/internal/auth/users/by-identity/${encodeURIComponent(provider)}/${encodeURIComponent(providerAccountId)}`
      );
      return user ? mapToAdapterUser(user) : null;
    },

    async updateUser(user: Partial<AdapterUser> & { id: string }) {
      return user as AdapterUser;
    },

    async deleteUser(_userId: string) {
      return;
    },

    async linkAccount(account: AdapterAccount) {
      await internalApiFetch("/internal/auth/users/link", {
        method: "POST",
        body: JSON.stringify({
          email: account.email ?? undefined,
          provider: account.provider,
          providerUserId: account.providerAccountId,
          userId: account.userId
        })
      });
    },

    async unlinkAccount(_account: Pick<AdapterAccount, "provider" | "providerAccountId">) {
      return;
    },

    async createVerificationToken(verificationToken) {
      const created = await internalApiFetch<VerificationTokenDto>("/internal/auth/verification-tokens", {
        method: "POST",
        body: JSON.stringify({
          identifier: verificationToken.identifier,
          token: verificationToken.token,
          expires: verificationToken.expires.toISOString()
        })
      });

      if (!created) {
        return null;
      }

      return {
        ...created,
        expires: new Date(created.expires)
      };
    },

    async useVerificationToken({ identifier, token }) {
      const used = await internalApiFetch<VerificationTokenDto>("/internal/auth/verification-tokens/verify", {
        method: "POST",
        body: JSON.stringify({ identifier, token })
      });

      if (!used) {
        return null;
      }

      return {
        ...used,
        expires: new Date(used.expires)
      };
    }
  };
}
