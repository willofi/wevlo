import {
  createUserId,
  createUserIdentityId
} from "@wevlo/core";

import type { UserDto, UserIdentityDto } from "@wevlo/contracts";

export type User = UserDto;
export type UserIdentity = UserIdentityDto;

export const createUser = (input: { name: string; email?: string | null }): User => ({
  createdAt: new Date().toISOString(),
  email: input.email ?? null,
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
