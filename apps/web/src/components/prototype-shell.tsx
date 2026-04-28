"use client";

import Link from "next/link";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import { UserPlus } from "lucide-react";

import type { ProjectSummaryDto } from "@wevlo/contracts";
import { ScrollArea, cn } from "@wevlo/ui-web";

import { AccountMenu } from "@/components/account-menu";
import { GlobalWorkspaceActions, type WorkspaceActionsContext } from "@/components/global-workspace-actions";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { NotificationSummaryProvider } from "@/components/notification-summary-provider";
import { PersonalNav } from "@/components/personal-nav";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

type ShellWorkspace = {
  name: string;
  slug: string;
};

type ShellViewer = {
  avatarUrl?: string | null;
  email?: string | null;
  name: string;
};

type PrototypeShellProps = PropsWithChildren<{
  currentProjectKey?: string;
  currentWorkspaceSlug?: string;
  footer?: ReactNode;
  header?: ReactNode;
  inspector?: ReactNode;
  projects?: ProjectSummaryDto[];
  viewer: ShellViewer;
  workspaceActionsContext?: WorkspaceActionsContext;
  workspaces: ShellWorkspace[];
}>;

export function PrototypeShell({
  children,
  currentProjectKey,
  currentWorkspaceSlug,
  footer,
  header,
  inspector,
  projects = [],
  viewer,
  workspaceActionsContext,
  workspaces
}: PrototypeShellProps) {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  return (
    <NotificationSummaryProvider>
      <div className="h-screen overflow-hidden bg-background text-foreground">
        {currentWorkspaceSlug && (
          <InviteMemberDialog
            workspaceSlug={currentWorkspaceSlug}
            open={isInviteDialogOpen}
            onOpenChange={setIsInviteDialogOpen}
          />
        )}
        <div className="grid h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden h-screen min-h-0 bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
          <div className="px-3 py-3.5">
            <Link href="/" className="block">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-muted-foreground">WEVLO</div>
            </Link>
            <div className="mt-2.5 flex items-center gap-1.5">
              <div className="min-w-0 flex-1">
                <WorkspaceSwitcher
                  currentWorkspaceSlug={currentWorkspaceSlug}
                  variant="minimal"
                  workspaces={workspaces}
                />
              </div>
              {currentWorkspaceSlug && workspaceActionsContext ? (
                <GlobalWorkspaceActions {...workspaceActionsContext} variant="sidebar" />
              ) : null}
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="grid gap-5 px-2.5 py-3">
              <PersonalNav compact />
              {currentWorkspaceSlug ? (
                <>
                  <section>
                    <div className="px-2 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                      Projects
                    </div>
                    <div className="mt-1 grid gap-0.5">
                      {projects.map((project) => (
                        <Link
                          key={project.id}
                          href={`/${currentWorkspaceSlug}/${project.key}`}
                          className={cn(
                            "rounded-xl px-2 py-1.5 text-[13px] transition-colors",
                            project.key === currentProjectKey
                              ? "bg-sidebar-foreground/8 text-sidebar-foreground"
                              : "text-muted-foreground hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground">{project.key}</span>
                            <span className="truncate font-medium">{project.name}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                  <section>
                    <div className="px-2 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                      Team
                    </div>
                    <div className="mt-1 grid gap-0.5">
                      <button
                        type="button"
                        onClick={() => setIsInviteDialogOpen(true)}
                        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-all hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground group"
                      >
                        <UserPlus className="size-3.5 transition-colors group-hover:text-primary" />
                        Invite people
                      </button>
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </ScrollArea>

          <div className="shrink-0 px-2.5 py-2.5">
            <AccountMenu align="start" avatarUrl={viewer.avatarUrl} email={viewer.email} name={viewer.name} side="top" trigger="sidebar" />
            {footer ? <div className="mt-3">{footer}</div> : null}
          </div>
        </aside>

        <div className="grid h-screen min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          {header ? (
            <header className="shrink-0 bg-background/95 px-4 py-4 backdrop-blur lg:px-8">
              {header}
            </header>
          ) : null}
          <div className={cn("grid min-h-0 overflow-hidden", inspector ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "grid-cols-1")}>
            <main className="min-h-0 min-w-0 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">{children}</main>
            {inspector ? (
              <aside className="hidden min-h-0 overflow-y-auto bg-card/65 xl:block">
                {inspector}
              </aside>
            ) : null}
          </div>
        </div>
        </div>
      </div>
    </NotificationSummaryProvider>
  );
}
