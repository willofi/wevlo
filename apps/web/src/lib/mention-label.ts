import type { WorkspaceMemberDto } from "@wevlo/contracts";

export const formatMentionHandle = (handle: string): string => `@${handle}`;

export const getWorkspaceMemberMentionLabel = (member: WorkspaceMemberDto): string =>
  formatMentionHandle(member.user.handle);
