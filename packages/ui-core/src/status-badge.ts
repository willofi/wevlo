export type StatusTone = "backlog" | "todo" | "in_progress" | "done" | "canceled";

export const getStatusToneLabel = (status: StatusTone): string => {
  switch (status) {
    case "backlog":
      return "Backlog";
    case "todo":
      return "Todo";
    case "in_progress":
      return "In Progress";
    case "done":
      return "Done";
    case "canceled":
      return "Canceled";
  }
};
