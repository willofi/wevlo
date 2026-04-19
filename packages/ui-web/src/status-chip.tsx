import { getStatusToneLabel, type StatusTone } from "@wevlo/ui-core";

import { Badge } from "./components/ui/badge";

const tones: Record<StatusTone, "muted" | "info" | "success" | "outline"> = {
  backlog: "muted",
  todo: "info",
  in_progress: "success",
  done: "success",
  canceled: "outline"
};

export const StatusChip = ({ status }: { status: StatusTone }) => {
  return <Badge variant={tones[status]}>{getStatusToneLabel(status)}</Badge>;
};
