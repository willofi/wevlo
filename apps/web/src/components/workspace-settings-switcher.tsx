"use client";

import { useRouter } from "next/navigation";

type WorkspaceSettingsSwitcherProps = {
  active: "access" | "members";
  currentWorkspaceSlug: string;
  workspaces: Array<{
    name: string;
    slug: string;
  }>;
};

export function WorkspaceSettingsSwitcher({
  active,
  currentWorkspaceSlug,
  workspaces
}: WorkspaceSettingsSwitcherProps) {
  const router = useRouter();

  return (
    <div className="grid gap-2">
      <label htmlFor="workspace-settings-switcher" className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        Workspace switcher
      </label>
      <select
        id="workspace-settings-switcher"
        value={currentWorkspaceSlug}
        onChange={(event) => {
          router.push(`/${event.target.value}/settings/${active}`);
        }}
        className="flex h-10 w-full rounded-lg border border-input bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.slug} value={workspace.slug}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  );
}
