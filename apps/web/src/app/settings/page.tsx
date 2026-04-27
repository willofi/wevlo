import { SettingsPageClient } from "@/components/settings-page-client";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getMe } from "@/lib/server-api";

type SettingsPageProps = {
  searchParams: Promise<{
    section?: string;
  }>;
};

const resolveSection = (value: string | undefined): "preferences" | "profile" =>
  value === "preferences" ? "preferences" : "profile";

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [authSession, me, resolvedSearchParams] = await Promise.all([
    requireCurrentAuthSession("/settings"),
    getMe(),
    searchParams
  ]);

  const backHref = authSession.defaultWorkspaceSlug ? `/${authSession.defaultWorkspaceSlug}` : "/";

  return (
    <SettingsPageClient
      backHref={backHref}
      initialSection={resolveSection(resolvedSearchParams.section)}
      user={me.user}
    />
  );
}
