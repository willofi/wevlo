import { permanentRedirect } from "next/navigation";

type MembersSettingsPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function MembersSettingsPage({ params }: MembersSettingsPageProps) {
  const { workspaceSlug } = await params;
  permanentRedirect(`/${workspaceSlug}/members`);
}
