import type { UserDto } from "@wevlo/contracts";

import type { User } from "../domain/user";

export type CurrentUserRepository = {
  createUserWithIdentity: (input: {
    avatarUrl?: string | null;
    email?: string | null;
    name: string;
    provider: UserDto["identities"][number]["provider"];
    providerUserId: string;
  }) => Promise<User>;
  findUserByIdentity: (
    provider: UserDto["identities"][number]["provider"],
    providerUserId: string
  ) => Promise<User | null>;
  syncUserProfileFromIdentity: (input: {
    avatarUrl?: string | null;
    email?: string | null;
    name?: string | null;
    userId: string;
  }) => Promise<User>;
};

export const resolveCurrentUserUseCase = async (
  repository: CurrentUserRepository,
  input: {
    avatarUrl?: string | null;
    email?: string | null;
    name: string;
    provider: UserDto["identities"][number]["provider"];
    providerUserId: string;
  }
): Promise<User> => {
  const existing = await repository.findUserByIdentity(input.provider, input.providerUserId);

  if (existing) {
    return repository.syncUserProfileFromIdentity({
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      name: input.name,
      userId: existing.id
    });
  }

  // 1. 구글이나 이메일 인증을 통한 가입은 언제나 허용합니다. (실제 인증이 완료된 상태)
  if (input.provider === "google" || input.provider === "email") {
    return repository.createUserWithIdentity(input);
  }

  // 2. 데모(dev) 프로바이더의 경우, 미리 정의된 데모 사용자 ID인 경우만 자동 생성을 허용합니다.
  const allowedDemoIds = ["user_demo_owner", "user-ava", "user-noah", "user-kim", "user-lucas"];
  if (input.provider === "dev" && allowedDemoIds.includes(input.providerUserId)) {
    return repository.createUserWithIdentity(input);
  }

  throw new Error(`Unauthorized: User creation not allowed for provider ${input.provider} with ID ${input.providerUserId}`);
};
