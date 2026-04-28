import type { FastifyRequest } from "fastify";

import { getDevUserId, getInternalAuthToken, isDevAuthAllowed } from "@wevlo/data-access";
import type { AuthProvider } from "@wevlo/contracts";

import { UnauthorizedError } from "./errors.js";

export type RequestIdentity = {
  avatarUrl?: string | null;
  email: string | null;
  name: string;
  provider: AuthProvider;
  providerUserId: string;
  userIdHint: string | null;
};

const getSingleHeader = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value) && value[0] && value[0].trim().length > 0) {
    return value[0];
  }

  return null;
};

const getHeaderAllowEmpty = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
};

export const getRequestIdentity = (request: FastifyRequest): RequestIdentity => {
  const internalToken = getSingleHeader(request.headers["x-wevlo-internal-token"]);

  if (internalToken && internalToken === getInternalAuthToken()) {
    const provider = getSingleHeader(request.headers["x-wevlo-auth-provider"]);
    const providerUserId = getSingleHeader(request.headers["x-wevlo-provider-user-id"]);
    const userName = getHeaderAllowEmpty(request.headers["x-wevlo-user-name"]);
    const userAvatarUrl = getSingleHeader(request.headers["x-wevlo-user-avatar-url"]);
    const userEmail = getSingleHeader(request.headers["x-wevlo-user-email"]);
    const userIdHint = getSingleHeader(request.headers["x-wevlo-user-id"]);

    if (!provider || !providerUserId || userName === null) {
      throw new UnauthorizedError("Incomplete internal auth headers");
    }

    return {
      email: userEmail,
      name: userName,
      avatarUrl: userAvatarUrl,
      provider: provider as AuthProvider,
      providerUserId,
      userIdHint
    };
  }

  if (isDevAuthAllowed()) {
    const header = getSingleHeader(request.headers["x-dev-user-id"]);
    const providerUserId = header ?? getDevUserId();

    return {
      email: null,
      name: providerUserId,
      avatarUrl: null,
      provider: "dev",
      providerUserId,
      userIdHint: null
    };
  }

  throw new UnauthorizedError();
};
