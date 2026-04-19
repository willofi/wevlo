import { ShellPageState } from "@/components/shell-page-state";

export default function NotFound() {
  return (
    <ShellPageState
      tone="warning"
      eyebrow="Not found"
      title="This page could not be found"
      shellTitle="Page unavailable"
      shellSubtitle="The link may be outdated, the resource may have moved, or you may not have access to it."
      body="Try returning to the workspace chooser, then open the workspace or issue from a known path."
      actionLabel="Return home"
    />
  );
}
