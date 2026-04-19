import Link from "next/link";
import { Bell, MessageSquareMore, UserRoundPlus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wevlo/ui-web";

import type { AppNotification } from "@/lib/notifications";

type NotificationsPageClientProps = {
  items: AppNotification[];
};

const kindIcon = {
  assignment: UserRoundPlus,
  comment: MessageSquareMore,
  mention: Bell
} as const;

export function NotificationsPageClient({ items }: NotificationsPageClientProps) {
  return (
    <div className="grid gap-4">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Notifications inbox</CardTitle>
          <CardDescription>
            Mentions, assignee changes, and comments can land here. The current list is placeholder data so the UI is ready before server-backed delivery exists.
          </CardDescription>
        </CardHeader>
      </Card>
      {items.map((item) => {
        const Icon = kindIcon[item.kind];

        return (
          <Link key={item.id} href={item.href} className="block">
            <Card className="shadow-none transition-colors hover:bg-secondary/35">
              <CardContent className="flex items-start gap-3 p-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    {item.isUnread ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.createdLabel}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
