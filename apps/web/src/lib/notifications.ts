export type AppNotification = {
  body: string;
  createdLabel: string;
  href: string;
  id: string;
  isUnread: boolean;
  kind: "assignment" | "comment" | "mention";
  title: string;
};

export const getPlaceholderNotifications = (input: {
  currentWorkspaceSlug?: string;
  workspaces: Array<{
    name: string;
    slug: string;
  }>;
}): AppNotification[] => {
  const workspaceSlug = input.currentWorkspaceSlug ?? input.workspaces[0]?.slug;

  if (!workspaceSlug) {
    return [];
  }

  return [
    {
      id: "assignment-1",
      kind: "assignment",
      isUnread: true,
      title: "Assigned to you",
      body: "A new issue is ready for your review in this workspace.",
      createdLabel: "Just now",
      href: `/${workspaceSlug}/my-issues`
    },
    {
      id: "mention-1",
      kind: "mention",
      isUnread: true,
      title: "Mentioned in discussion",
      body: "A teammate mentioned you in an issue comment.",
      createdLabel: "12m ago",
      href: "/notifications"
    },
    {
      id: "comment-1",
      kind: "comment",
      isUnread: false,
      title: "New comment on tracked work",
      body: "Recent activity is available for an issue you created.",
      createdLabel: "1h ago",
      href: "/notifications"
    }
  ];
};
