import { AppShell } from "@/components/app-shell";
import { NotificationsPageClient } from "@/components/notifications-page-client";
import { getAppShellData } from "@/lib/app-shell-data";
import { listWorkspaces } from "@/lib/server-api";

type NotificationsPageProps = {
  searchParams: Promise<{
    project?: string;
    status?: "all" | "archived" | "unread";
    workspace?: string;
  }>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const [params, { viewer, workspaces: shellWorkspaces }, workspaces] = await Promise.all([
    searchParams,
    getAppShellData(),
    listWorkspaces()
  ]);

  return (
    <AppShell
      viewer={viewer}
      workspaces={shellWorkspaces}
      title="Inbox"
      subtitle="All of your notifications in one place, with direct links back to the exact issue context."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Inbox" }
      ]}
    >
      <NotificationsPageClient
        {...(params.project ? { initialProjectId: params.project } : {})}
        {...(params.status ? { initialStatus: params.status } : {})}
        {...(params.workspace ? { initialWorkspaceId: params.workspace } : {})}
        workspaces={workspaces}
      />
    </AppShell>
  );
}
