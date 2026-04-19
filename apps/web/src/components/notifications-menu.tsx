"use client";

import Link from "next/link";
import { Bell, MessageSquareMore, UserRoundPlus } from "lucide-react";

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@wevlo/ui-web";

import type { AppNotification } from "@/lib/notifications";

type NotificationsMenuProps = {
  items: AppNotification[];
};

const kindIcon = {
  assignment: UserRoundPlus,
  comment: MessageSquareMore,
  mention: Bell
} as const;

export function NotificationsMenu({ items }: NotificationsMenuProps) {
  const unreadCount = items.filter((item) => item.isUnread).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative rounded-full" aria-label="Notifications">
          <Bell className="size-4" />
          {unreadCount > 0 ? <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem]">
        <div className="flex items-center justify-between px-2.5 py-2">
          <DropdownMenuLabel className="p-0 text-xs tracking-[0.18em]">Notifications</DropdownMenuLabel>
          <Link href="/notifications" className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
            View all
          </Link>
        </div>
        <DropdownMenuSeparator />
        {items.length > 0 ? (
          <div className="grid gap-1">
            {items.map((item) => {
              const Icon = kindIcon[item.kind];

              return (
                <DropdownMenuItem key={item.id} asChild className="items-start px-2 py-2.5">
                  <Link href={item.href} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {item.isUnread ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-muted-foreground">{item.body}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{item.createdLabel}</span>
                    </span>
                  </Link>
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
            <Link href="/notifications">Open notifications inbox</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
