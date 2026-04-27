"use client";

import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";

import type { NotificationSummaryDto } from "@wevlo/contracts";

import { getNotificationSummary, markNotificationsRead, markNotificationsSeen } from "@/lib/issue-hub-data";

type NotificationSummaryContextValue = {
  isLoading: boolean;
  markRead: (ids: string[]) => Promise<void>;
  markSeen: (ids: string[]) => Promise<void>;
  refresh: () => Promise<void>;
  summary: NotificationSummaryDto;
};

const emptySummary: NotificationSummaryDto = {
  items: [],
  unseenCount: 0
};

const NotificationSummaryContext = createContext<NotificationSummaryContextValue>({
  isLoading: true,
  markRead: async () => {},
  markSeen: async () => {},
  refresh: async () => {},
  summary: emptySummary
});

export function NotificationSummaryProvider({ children }: PropsWithChildren) {
  const [summary, setSummary] = useState<NotificationSummaryDto>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    const next = await getNotificationSummary();
    setSummary(next);
    setIsLoading(false);
  };

  const markSeen = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    await markNotificationsSeen(ids);
    setSummary((current) => ({
      ...current,
      items: current.items.map((item) =>
        ids.includes(item.id) ? { ...item, seenAt: item.seenAt ?? new Date().toISOString() } : item
      ),
      unseenCount: Math.max(0, current.unseenCount - current.items.filter((item) => item.seenAt === null && ids.includes(item.id)).length)
    }));
  };

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    await markNotificationsRead(ids);
    setSummary((current) => ({
      ...current,
      items: current.items.map((item) =>
        ids.includes(item.id)
          ? {
              ...item,
              readAt: item.readAt ?? new Date().toISOString(),
              seenAt: item.seenAt ?? new Date().toISOString()
            }
          : item
      ),
      unseenCount: Math.max(0, current.unseenCount - current.items.filter((item) => item.seenAt === null && ids.includes(item.id)).length)
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await getNotificationSummary();

        if (!cancelled) {
          setSummary(next);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 60_000);

    const handleFocus = () => {
      void load();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <NotificationSummaryContext.Provider
      value={{
        isLoading,
        markRead,
        markSeen,
        refresh,
        summary
      }}
    >
      {children}
    </NotificationSummaryContext.Provider>
  );
}

export const useNotificationSummary = () => useContext(NotificationSummaryContext);
