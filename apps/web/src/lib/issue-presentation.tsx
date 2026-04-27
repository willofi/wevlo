"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronUp,
  ChevronsUp,
  CircleDashed,
  Clock3,
  ListTodo,
  LoaderCircle,
  Minus
} from "lucide-react";
import { HiOutlineBolt, HiOutlineFlag, HiOutlineRocketLaunch, HiOutlineSparkles } from "react-icons/hi2";

import type {
  IssuePriority,
  IssueState,
  ProjectBoardColumnConfigDto,
  ProjectBoardIconKey
} from "@wevlo/contracts";

export const labelColorClasses: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  slate: "bg-slate-500",
  violet: "bg-violet-500",
  yellow: "bg-yellow-500"
};

export const priorityOptions: Array<{ label: string; value: IssuePriority }> = [
  { label: "No priority", value: "none" },
  { label: "Urgent", value: "urgent" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" }
];

export const priorityToneClasses: Record<IssuePriority, string> = {
  none: "text-muted-foreground",
  low: "text-sky-400",
  medium: "text-emerald-400",
  high: "text-amber-400",
  urgent: "text-orange-400"
};

export const priorityBadgeClasses: Record<IssuePriority, string> = {
  none: "border-border/70 bg-background/60 text-muted-foreground",
  low: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  medium: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  high: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  urgent: "border-orange-500/25 bg-orange-500/10 text-orange-300"
};

export const TripleChevronUp = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m17 6-5-5-5 5" />
    <path d="m17 12-5-5-5 5" />
    <path d="m17 18-5-5-5 5" />
  </svg>
);

export const getPriorityIcon = (priority: IssuePriority) => {
  switch (priority) {
    case "urgent":
      return <AlertTriangle className="size-3.5" />;
    case "high":
      return <TripleChevronUp className="size-3.5" />;
    case "medium":
      return <ChevronsUp className="size-3.5" />;
    case "low":
      return <ChevronUp className="size-3.5" />;
    case "none":
    default:
      return <Minus className="size-3.5" />;
  }
};

export const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export const endOfWeek = () => {
  const date = new Date();
  const day = date.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilFriday);
  return formatDate(date);
};

export const inDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDate(date);
};

export const projectBoardIconOptions: Array<{
  iconKey: ProjectBoardIconKey;
  label: string;
}> = [
  { iconKey: "circle_dashed", label: "Circle dashed" },
  { iconKey: "list_todo", label: "List todo" },
  { iconKey: "loader_circle", label: "Loader" },
  { iconKey: "check_circle_2", label: "Check circle" },
  { iconKey: "ban", label: "Ban" },
  { iconKey: "clock_3", label: "Clock" },
  { iconKey: "sparkles", label: "Sparkles" },
  { iconKey: "rocket", label: "Rocket" },
  { iconKey: "flag", label: "Flag" },
  { iconKey: "bolt", label: "Bolt" }
];

export const defaultStatePresentation: Record<
  IssueState,
  { iconKey: ProjectBoardIconKey; label: string }
> = {
  backlog: { iconKey: "circle_dashed", label: "Backlog" },
  todo: { iconKey: "list_todo", label: "Todo" },
  in_progress: { iconKey: "loader_circle", label: "In progress" },
  done: { iconKey: "check_circle_2", label: "Done" },
  canceled: { iconKey: "ban", label: "Canceled" }
};

export const renderProjectBoardIcon = (
  iconKey: ProjectBoardIconKey,
  className = "size-3.5"
): ReactNode => {
  switch (iconKey) {
    case "list_todo":
      return <ListTodo className={className} />;
    case "loader_circle":
      return <LoaderCircle className={className} />;
    case "check_circle_2":
      return <CheckCircle2 className={className} />;
    case "ban":
      return <Ban className={className} />;
    case "clock_3":
      return <Clock3 className={className} />;
    case "sparkles":
      return <HiOutlineSparkles className={className} />;
    case "rocket":
      return <HiOutlineRocketLaunch className={className} />;
    case "flag":
      return <HiOutlineFlag className={className} />;
    case "bolt":
      return <HiOutlineBolt className={className} />;
    case "circle_dashed":
    default:
      return <CircleDashed className={className} />;
  }
};

export const buildProjectStateOptions = (
  columns: ProjectBoardColumnConfigDto[] | undefined
): Array<{ iconKey: ProjectBoardIconKey; label: string; value: IssueState }> => {
  const byState = new Map(columns?.map((column) => [column.state, column]));

  return (Object.keys(defaultStatePresentation) as IssueState[]).map((state) => {
    const fallback = defaultStatePresentation[state];
    const override = byState.get(state);

    return {
      iconKey: override?.iconKey ?? fallback.iconKey,
      label: override?.label ?? fallback.label,
      value: state
    };
  });
};

export const getProjectStatePresentation = (
  state: IssueState,
  columns: ProjectBoardColumnConfigDto[] | undefined
) => buildProjectStateOptions(columns).find((option) => option.value === state) ?? {
  ...defaultStatePresentation[state],
  value: state
};
