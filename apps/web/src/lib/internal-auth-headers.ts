import { buildInternalAuthHeaders, type InternalAuthHeaders } from "@wevlo/auth";
import type { AuthProvider } from "@wevlo/contracts";

export type InternalAuthIdentity = {
  provider: AuthProvider;
  providerUserId: string;
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
      userEmail: identity.userEmail,
      userId: identity.userId,
      userName: identity.userName
    },
    internalToken
  );
