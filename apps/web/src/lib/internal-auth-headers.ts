import { buildInternalAuthHeaders, type InternalAuthHeaders } from "@wevlo/auth";
import type { AuthProvider } from "@wevlo/contracts";

export type InternalAuthIdentity = {
  provider: AuthProvider;
  providerUserId: string;
  userAvatarUrl?: string | null;
  userEmail: string;
  userId: string;
  userName: string;
};

export const buildApiInternalAuthHeaders = (
  identity: InternalAuthIdentity,
  internalToken: string
): InternalAuthHeaders =>
  buildInternalAuthHeaders(
    {
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      ...(identity.userAvatarUrl !== undefined ? { userAvatarUrl: identity.userAvatarUrl } : {}),
      userEmail: identity.userEmail,
      userId: identity.userId,
      userName: identity.userName
    },
    internalToken
  );
