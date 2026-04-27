"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ListTodo } from "lucide-react";

import { cn } from "@wevlo/ui-web";

import { useNotificationSummary } from "@/components/notification-summary-provider";
import { getInboxHref, getMyIssuesHref } from "@/lib/issue-hub-data";

type PersonalNavProps = {
  compact?: boolean;
};

export function PersonalNav({ compact = false }: PersonalNavProps) {
  const pathname = usePathname();
  const { summary } = useNotificationSummary();

  const items = [
    {
      active: pathname === "/notifications",
      badge: summary.unseenCount,
      href: getInboxHref(),
      icon: Bell,
      label: "Inbox"
    },
    {
      active: pathname === "/my-issues" || pathname.endsWith("/my-issues"),
      badge: 0,
      href: getMyIssuesHref(),
      icon: ListTodo,
      label: "My issues"
    }
  ];

  return (
    <section>
      {!compact ? (
        <div className="px-2 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Personal</div>
      ) : null}
      <div className={cn("grid gap-0.5", compact ? "" : "mt-1.5")}>
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                compact
                  ? "flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-[13px] transition-colors"
                  : "flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors",
                item.active
                  ? "bg-sidebar-foreground/8 text-sidebar-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                  : "text-muted-foreground hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className={cn("size-3.5 shrink-0", item.active ? "text-sidebar-foreground" : "text-muted-foreground")} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge > 0 ? (
                <span className="rounded-full bg-sidebar-foreground/8 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
