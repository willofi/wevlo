import type { UserDto } from "@wevlo/contracts";

import type { User } from "../domain/user";

export type CurrentUserRepository = {
  createUserWithIdentity: (input: {
    email?: string | null;
    name: string;
    provider: UserDto["identities"][number]["provider"];
    providerUserId: string;
  }) => Promise<User>;
  findUserByIdentity: (
    provider: UserDto["identities"][number]["provider"],
    providerUserId: string
  ) => Promise<User | null>;
};

export const resolveCurrentUserUseCase = async (
  repository: CurrentUserRepository,
  input: {
    email?: string | null;
    name: string;
    provider: UserDto["identities"][number]["provider"];
    providerUserId: string;
  }
): Promise<User> => {
  const existing = await repository.findUserByIdentity(input.provider, input.providerUserId);

  if (existing) {
    return existing;
  }

  return repository.createUserWithIdentity(input);
};
