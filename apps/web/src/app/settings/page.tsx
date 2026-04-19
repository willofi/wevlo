import { AppShell } from "@/components/app-shell";
import { SettingsPageClient } from "@/components/settings-page-client";
import { getAppShellData } from "@/lib/app-shell-data";

export default async function SettingsPage() {
  const { viewer, workspaces } = await getAppShellData();

  return (
    <AppShell
      viewer={viewer}
      workspaces={workspaces}
      title="Settings"
      subtitle="Personalize how WEVLO looks and where it lands before you dive back into work."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Settings" }
      ]}
    >
      <SettingsPageClient />
    </AppShell>
  );
}
