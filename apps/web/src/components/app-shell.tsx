"use client";

import Link from "next/link";
import { ListTodo, Menu, Search, SquareDashedMousePointer, UserPlus } from "lucide-react";
import { HiOutlineChevronDoubleRight } from "react-icons/hi2";
import { Fragment, useMemo, useState, type PropsWithChildren, type ReactNode } from "react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, cn } from "@wevlo/ui-web";

import { AccountMenu } from "@/components/account-menu";
import { useAppPreferences } from "@/components/app-preferences-provider";
import { GlobalWorkspaceActions, type WorkspaceActionsContext } from "@/components/global-workspace-actions";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { NotificationSummaryProvider } from "@/components/notification-summary-provider";
import { NotificationsMenu } from "@/components/notifications-menu";
import { PersonalNav } from "@/components/personal-nav";
import { UserMenu } from "@/components/user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { getMyIssuesHref } from "@/lib/issue-hub-data";

type AppShellWorkspace = {
  name: string;
  slug: string;
};

type AppShellViewer = {
  email?: string | null | undefined;
  name: string;
};

type BreadcrumbEntry = {
  href?: string;
  label: string;
};

type AppShellProps = PropsWithChildren<{
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbEntry[];
  currentWorkspaceSlug?: string | undefined;
  newIssueHref?: string | undefined;
  sidebar?: ReactNode;
  subtitle?: string | undefined;
  tabs?: ReactNode;
  title: string;
  viewer: AppShellViewer;
  workspaceActionsContext?: WorkspaceActionsContext;
  workspaces: AppShellWorkspace[];
}>;

function Breadcrumbs({ items }: { items: BreadcrumbEntry[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            <BreadcrumbItem>
              {item.href ? (
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {index < items.length - 1 ? <BreadcrumbSeparator /> : null}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SidebarIconButton({
  children,
  href,
  label,
  onClick
}: {
  children: ReactNode;
  href?: string;
  label: string;
  onClick?: () => void;
}) {
  const className =
    "flex h-9 items-center justify-center rounded-xl bg-sidebar-foreground/6 text-sidebar-foreground transition-colors hover:bg-sidebar-foreground/10";

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function AppShell({
  actions,
  breadcrumbs,
  children,
  currentWorkspaceSlug,
  newIssueHref,
  sidebar,
  subtitle,
  tabs,
  title,
  viewer,
  workspaceActionsContext,
  workspaces
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { preferences, setPreference } = useAppPreferences();
  const isCompact = preferences.density === "compact";
  const headerMyIssuesHref = getMyIssuesHref();
  const homePanel = currentWorkspaceSlug ? (
    <Link href="/" className="block rounded-2xl bg-sidebar-foreground/[0.035] px-3 py-2.5 transition-colors hover:bg-sidebar-foreground/[0.06]">
      <div className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">WEVLO</div>
      <div className="mt-1 text-[13px] font-semibold text-foreground">All workspaces</div>
      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
        Return to the chooser
      </p>
    </Link>
  ) : (
    <div className="rounded-2xl bg-sidebar-foreground/[0.035] px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">WEVLO</div>
      <div className="mt-1 text-[13px] font-semibold text-foreground">Workspace home</div>
    </div>
  );
  const sidebarNavContent = useMemo(
    () => (
      <>
        {homePanel}
        <WorkspaceSwitcher
          workspaces={workspaces}
          {...(currentWorkspaceSlug ? { currentWorkspaceSlug } : {})}
        />
        <PersonalNav />
        {sidebar ? <div className="space-y-5">{sidebar}</div> : null}

        {currentWorkspaceSlug && (
          <div className="mt-auto pt-4 border-t border-sidebar-foreground/10">
            <button
              type="button"
              onClick={() => setIsInviteDialogOpen(true)}
              className="inline-flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-medium text-muted-foreground transition-all hover:bg-sidebar-foreground/5 hover:text-foreground group"
            >
              <UserPlus className="size-3.5 transition-colors group-hover:text-primary" />
              Invite people
            </button>
          </div>
        )}
      </>
    ),
    [currentWorkspaceSlug, homePanel, sidebar, workspaces]
  );

  const sidebarFooterContent = useMemo(
    () =>
      preferences.sidebarCollapsed ? (
        <div className="grid gap-2">
          <AccountMenu align="start" email={viewer.email} name={viewer.name} side="right" trigger="collapsed" />
          <SidebarIconButton label="Expand sidebar" onClick={() => setPreference("sidebarCollapsed", false)}>
            <HiOutlineChevronDoubleRight className="size-4" />
          </SidebarIconButton>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AccountMenu align="start" email={viewer.email} name={viewer.name} side="top" trigger="sidebar" />
          <button
            type="button"
            onClick={() => setPreference("sidebarCollapsed", !preferences.sidebarCollapsed)}
            className="inline-flex h-8 w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground"
          >
            <HiOutlineChevronDoubleRight className="size-4 rotate-180" />
            Collapse sidebar
          </button>
        </div>
      ),
    [preferences.sidebarCollapsed, setPreference, viewer.email, viewer.name]
  );

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
        <div
          className={cn(
            "h-screen lg:grid",
            preferences.sidebarCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[224px_minmax(0,1fr)]"
          )}
        >
        <aside
          className={cn(
            "hidden h-screen bg-sidebar px-2.5 py-2.5 text-[13px] text-sidebar-foreground backdrop-blur lg:flex lg:flex-col",
            preferences.sidebarCollapsed && "lg:px-2"
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {preferences.sidebarCollapsed ? (
                <div className="grid gap-2 pr-0.5">
                  <SidebarIconButton href="/" label="Return to workspaces">
                    <span className="text-xs font-semibold tracking-[0.3em] text-muted-foreground">WV</span>
                  </SidebarIconButton>
                </div>
              ) : (
                <div className="grid gap-2 pr-0.5 pb-2">
                  {sidebarNavContent}
                </div>
              )}
            </div>
            <div className="shrink-0 pt-2">
              {sidebarFooterContent}
            </div>
          </div>
        </aside>
        <div className="flex h-screen min-w-0 flex-col overflow-hidden">
          <header className="z-20 shrink-0 border-b border-border/70 bg-background/88 backdrop-blur">
            <div
              className={cn(
                "flex items-center gap-3",
                isCompact ? "px-3 py-2 sm:px-4 lg:px-5" : "px-4 py-2.5 sm:px-5 lg:px-6"
              )}
            >
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-background/70 lg:hidden"
                onClick={() => setIsMobileNavOpen((current) => !current)}
              >
                <Menu className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                {breadcrumbs && breadcrumbs.length > 0 ? <Breadcrumbs items={breadcrumbs} /> : null}
              </div>
              {currentWorkspaceSlug && workspaceActionsContext ? (
                <GlobalWorkspaceActions {...workspaceActionsContext} variant="header" />
              ) : (
                <Button variant="outline" className="hidden items-center gap-2 md:inline-flex" size="sm" disabled>
                  <Search className="size-4" />
                  Search soon
                </Button>
              )}
              <Button asChild variant="outline" size="icon" className="hidden rounded-full md:inline-flex" title="My issues" aria-label="My issues">
                <Link href={headerMyIssuesHref}>
                  <ListTodo className="size-4" />
                </Link>
              </Button>
              <NotificationsMenu />
              {newIssueHref && !(currentWorkspaceSlug && workspaceActionsContext) ? (
                <Button asChild className="items-center gap-2" size="sm">
                  <Link href={newIssueHref}>
                    <SquareDashedMousePointer className="size-4" />
                    New issue
                  </Link>
                </Button>
              ) : null}
              <UserMenu email={viewer.email} name={viewer.name} />
            </div>
            {isMobileNavOpen ? (
              <div className="max-h-[70vh] overflow-y-auto border-t border-border/70 bg-background px-4 py-4 lg:hidden">
                <div className="grid gap-4">
                  {sidebarNavContent}
                  <div className="border-t border-border/70 pt-4">
                    {sidebarFooterContent}
                  </div>
                </div>
              </div>
            ) : null}
          </header>
          <main className={cn("min-h-0 overflow-y-auto", isCompact ? "px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6" : "px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8")}>
            <section className={cn(isCompact ? "mb-3" : "mb-4")}>
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
                  {subtitle ? <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground">{subtitle}</p> : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              </div>
              {tabs ? <div className="mt-2.5">{tabs}</div> : null}
            </section>
            {children}
          </main>
        </div>
        </div>
      </div>
    </NotificationSummaryProvider>
  );
}
