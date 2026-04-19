import { AppShell } from "@/components/app-shell";
import { NotificationsPageClient } from "@/components/notifications-page-client";
import { getAppShellData } from "@/lib/app-shell-data";
import { getPlaceholderNotifications } from "@/lib/notifications";

export default async function NotificationsPage() {
  const { viewer, workspaces } = await getAppShellData();
  const items = getPlaceholderNotifications({ workspaces });

  return (
    <AppShell
      viewer={viewer}
      workspaces={workspaces}
      title="Notifications"
      subtitle="A compact activity center for mentions, comments, and assignment changes. These items are placeholders until backend delivery is connected."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Notifications" }
      ]}
    >
      <NotificationsPageClient items={items} />
    </AppShell>
  );
}
