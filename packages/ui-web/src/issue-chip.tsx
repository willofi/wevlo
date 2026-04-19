import { Badge } from "./components/ui/badge";

export type IssuePriority = "none" | "low" | "medium" | "high" | "urgent";
export type IssueTriageStatus = "pending" | "accepted";

const priorityVariants: Record<IssuePriority, "muted" | "info" | "success" | "warning" | "danger"> = {
  none: "muted",
  low: "info",
  medium: "success",
  high: "warning",
  urgent: "danger"
};

const triageVariants: Record<IssueTriageStatus, "outline" | "success"> = {
  pending: "outline",
  accepted: "success"
};

const labelForPriority = (priority: IssuePriority): string => {
  switch (priority) {
    case "none":
      return "No priority";
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "urgent":
      return "Urgent";
  }
};

const labelForTriage = (status: IssueTriageStatus): string => {
  switch (status) {
    case "pending":
      return "Pending triage";
    case "accepted":
      return "Accepted";
  }
};

export const PriorityChip = ({ priority }: { priority: IssuePriority }) => {
  return <Badge variant={priorityVariants[priority]}>{labelForPriority(priority)}</Badge>;
};

export const TriageChip = ({ status }: { status: IssueTriageStatus }) => {
  return <Badge variant={triageVariants[status]}>{labelForTriage(status)}</Badge>;
};
