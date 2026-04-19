import type { WorkspaceMemberDto } from "@wevlo/contracts";

import { getUserLabel } from "@/lib/issue-hub-data";

export type UserDirectoryEntry = {
  initials: string;
  name: string;
  userId: string;
};

export type UserDirectory = Record<string, UserDirectoryEntry>;

const buildInitials = (name: string): string => {
  const segments = name.trim().split(/\s+/).filter(Boolean);

  if (segments.length === 0) {
    return "U";
  }

  return `${segments[0]?.[0] ?? "U"}${segments[1]?.[0] ?? ""}`.toUpperCase();
};

export const buildUserDirectory = (members: WorkspaceMemberDto[]): UserDirectory =>
  Object.fromEntries(
    members.map((member) => [
      member.userId,
      {
        initials: buildInitials(member.user.name),
        name: member.user.name,
        userId: member.userId
      }
    ])
  );

export const getDirectoryUserLabel = (
  directory: UserDirectory,
  userId: string | null | undefined
): string => {
  if (!userId) {
    return "Unassigned";
  }

  return directory[userId]?.name ?? getUserLabel(userId);
};
