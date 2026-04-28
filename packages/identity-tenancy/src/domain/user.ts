import {
  createUserId,
  createUserIdentityId
} from "@wevlo/core";

import type { UserDto, UserIdentityDto } from "@wevlo/contracts";

export type User = UserDto & {
  avatarContentType: string | null;
  avatarStorageKey: string | null;
};
export type UserIdentity = UserIdentityDto;

const userHandlePattern = /^[a-z0-9_]{3,32}$/;

export class UserHandleTakenError extends Error {
  constructor(handle: string) {
    super(`Handle is already taken: ${handle}`);
    this.name = "UserHandleTakenError";
  }
}

export const normalizeUserHandle = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  return normalized.length >= 3 ? normalized : "user";
};

export const isUserHandleValid = (value: string): boolean => userHandlePattern.test(value);

export const createUser = (input: {
  avatarUrl?: string | null;
  avatarContentType?: string | null;
  email?: string | null;
  handle: string;
  name: string;
}): User => ({
  avatarContentType: input.avatarContentType ?? null,
  avatarStorageKey: null,
  avatarUrl: input.avatarUrl ?? null,
  createdAt: new Date().toISOString(),
  email: input.email ?? null,
  handle: input.handle,
  id: createUserId(),
  identities: [],
  name: input.name,
  updatedAt: new Date().toISOString()
});

export const createUserIdentity = (input: {
  email?: string | null;
  provider: UserIdentity["provider"];
  providerUserId: string;
  userId: string;
}): UserIdentity => ({
  createdAt: new Date().toISOString(),
  email: input.email ?? null,
  id: createUserIdentityId(),
  provider: input.provider,
  providerUserId: input.providerUserId,
  userId: input.userId
});
