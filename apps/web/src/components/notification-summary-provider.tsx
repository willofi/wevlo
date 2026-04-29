"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type PropsWithChildren } from "react";

import type { NotificationSummaryDto } from "@wevlo/contracts";

import { markNotificationsRead, markNotificationsSeen } from "@/lib/issue-hub-data";
import {
  optimisticMarkNotificationsRead,
  optimisticMarkNotificationsSeen,
  restoreNotificationSummary
} from "@/lib/query-cache-helpers";
import { useNotificationSummaryQuery } from "@/lib/query-hooks";
import { queryKeys } from "@/lib/query-keys";

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
  const queryClient = useQueryClient();
  const summaryQuery = useNotificationSummaryQuery();

  const markSeenMutation = useMutation({
    mutationFn: markNotificationsSeen,
    onError: (_error, _ids, context) => {
      restoreNotificationSummary(queryClient, context?.previous);
    },
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.summary() });
      return {
        previous: optimisticMarkNotificationsSeen(queryClient, ids)
      };
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.summary() });
    }
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationsRead,
    onError: (_error, _ids, context) => {
      restoreNotificationSummary(queryClient, context?.previous);
    },
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.summary() });
      return {
        previous: optimisticMarkNotificationsRead(queryClient, ids)
      };
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.summary() });
      await queryClient.invalidateQueries({ queryKey: ["notifications", "list"] });
    }
  });

  const refresh = async () => {
    await summaryQuery.refetch();
  };

  const markSeen = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    await markSeenMutation.mutateAsync(ids);
  };

  const markRead = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    await markReadMutation.mutateAsync(ids);
  };

  const summary = summaryQuery.data ?? emptySummary;
  const isLoading = summaryQuery.isLoading;

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
