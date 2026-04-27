import type { IssueCommentDto, IssueMentionDto } from "@wevlo/contracts";

type MentionableWorkspaceUser = {
  handle: string;
  userId: string;
};

// This pattern matches a mention preceded by start of string or a non-alphanumeric character.
// The handle itself is captured in group 2.
const mentionPattern = /(^|[^a-z0-9_])@([a-z0-9_]{3,32})/gi;

export const extractIssueMentions = (
  body: string,
  workspaceUsers: MentionableWorkspaceUser[]
): IssueMentionDto[] => {
  if (!body || workspaceUsers.length === 0) {
    return [];
  }

  const usersByHandle = new Map(
    workspaceUsers.map((user) => [user.handle.toLowerCase(), user])
  );
  const mentions: IssueMentionDto[] = [];

  // We must be careful with offsets when dealing with multibyte characters (like Hangul).
  // JavaScript's matchAll gives index in code units (UTF-16).
  // PostgreSQL's text type also treats them as characters.
  // So code unit indices are generally fine for offsets in modern JS/Postgres setups.
  
  for (const match of body.matchAll(mentionPattern)) {
    const prefix = match[1] ?? "";
    const handle = (match[2] ?? "").toLowerCase();
    const matchedUser = usersByHandle.get(handle);

    if (!matchedUser || match.index === undefined) {
      continue;
    }

    const startOffset = match.index + prefix.length;
    // The mention text in the body is "@" + handle.
    // However, we should use the actual length from the match to be safe.
    const mentionText = match[0].slice(prefix.length); // Should be "@handle"
    
    mentions.push({
      endOffset: startOffset + mentionText.length,
      handle: matchedUser.handle,
      startOffset,
      userId: matchedUser.userId
    });
  }

  return mentions;
};

export const extractCommentMentions = (
  body: string,
  workspaceUsers: MentionableWorkspaceUser[]
): IssueCommentDto["mentions"] => extractIssueMentions(body, workspaceUsers);
