"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, MailOpen, MessageSquareMore, UserRoundPlus, UserRoundSearch } from "lucide-react";

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@wevlo/ui-web";

import { useNotificationSummary } from "@/components/notification-summary-provider";

const categoryIcon = {
  access: UserRoundSearch,
  assignments: UserRoundPlus,
  comments: MessageSquareMore,
  invitations: MailOpen,
  mentions: Bell
} as const;

export function NotificationsMenu() {
  const router = useRouter();
  const { markRead, markSeen, summary } = useNotificationSummary();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      return;
    }

    const unseenIds = summary.items.filter((item) => item.seenAt === null).map((item) => item.id);
    void markSeen(unseenIds);
  };

  const handleItemOpen = async (id: string, href: string) => {
    await markRead([id]);
    router.push(href);
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative rounded-full" aria-label="Inbox">
          <Bell className="size-4" />
          {summary.unseenCount > 0 ? <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[24rem]">
        <div className="flex items-center justify-between px-2.5 py-2">
          <DropdownMenuLabel className="p-0 text-xs tracking-[0.18em]">Inbox</DropdownMenuLabel>
          <Link href="/notifications" className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
            View all
          </Link>
        </div>
        <DropdownMenuSeparator />
        {summary.items.length > 0 ? (
          <div className="grid gap-1">
            {summary.items.map((item) => {
              const Icon = categoryIcon[item.category];

              return (
                <DropdownMenuItem key={item.id} className="items-start px-2 py-2.5" onSelect={(event) => event.preventDefault()}>
                  <button type="button" onClick={() => void handleItemOpen(item.id, item.href)} className="flex w-full items-start gap-3 text-left">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {item.readAt === null ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.body}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}
                      </span>
                    </span>
                  </button>
                </DropdownMenuItem>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-4 text-sm text-muted-foreground">No notifications yet.</div>
        )}
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <Button asChild variant="outline" className="w-full justify-center">
            <Link href="/notifications">Open inbox</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
