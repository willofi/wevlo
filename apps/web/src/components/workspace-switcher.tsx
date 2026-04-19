"use client";

import Link from "next/link";
import { Building2, ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@wevlo/ui-web";

type WorkspaceSwitcherItem = {
  name: string;
  slug: string;
};

type WorkspaceSwitcherProps = {
  currentWorkspaceSlug?: string | undefined;
  workspaces: WorkspaceSwitcherItem[];
};

const RECENTS_STORAGE_KEY = "wevlo-recent-workspaces";

export function WorkspaceSwitcher({ currentWorkspaceSlug, workspaces }: WorkspaceSwitcherProps) {
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(RECENTS_STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as string[];
      setRecentSlugs(parsed.filter((value) => typeof value === "string"));
    } catch {
      window.localStorage.removeItem(RECENTS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!currentWorkspaceSlug) {
      return;
    }

    setRecentSlugs((current) => {
      const next = [currentWorkspaceSlug, ...current.filter((slug) => slug !== currentWorkspaceSlug)].slice(0, 6);
      window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [currentWorkspaceSlug]);

  const currentWorkspace = workspaces.find((workspace) => workspace.slug === currentWorkspaceSlug);
  const recentWorkspaces = useMemo(
    () =>
      recentSlugs
        .map((slug) => workspaces.find((workspace) => workspace.slug === slug))
        .filter((workspace): workspace is WorkspaceSwitcherItem => Boolean(workspace)),
    [recentSlugs, workspaces]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2.5 rounded-sm border border-border/70 bg-background/35 px-2.5 py-2 text-left transition-colors hover:bg-secondary/45"
        >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-background/55 text-muted-foreground">
            <Building2 className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground">Workspace</div>
            <div className="mt-0.5 truncate text-[13px] font-semibold text-foreground">
              {currentWorkspace?.name ?? "All workspaces"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {currentWorkspaceSlug ?? "Workspace chooser"}
            </div>
          </div>
        </div>
        <span className="inline-flex size-7 items-center justify-center rounded-full border border-border/70 bg-background/45 text-muted-foreground">
          <ChevronsUpDown className="size-4" />
        </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[15rem]">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/">All workspaces</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {recentWorkspaces.length > 0 ? (
          <>
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {recentWorkspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.slug} asChild>
                <Link href={`/${workspace.slug}`}>{workspace.name}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuLabel>All</DropdownMenuLabel>
        {workspaces.map((workspace) => (
          <DropdownMenuItem key={workspace.slug} asChild>
            <Link href={`/${workspace.slug}`}>
              <span className="inline-flex items-center gap-2">
                <span className={workspace.slug === currentWorkspaceSlug ? "text-primary" : "text-transparent"}>•</span>
                {workspace.name}
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
