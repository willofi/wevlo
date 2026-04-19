import { permanentRedirect } from "next/navigation";

type ProjectAccessSettingsPageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function ProjectAccessSettingsPage({ params }: ProjectAccessSettingsPageProps) {
  const { projectKey, workspaceSlug } = await params;
  permanentRedirect(`/${workspaceSlug}/${projectKey}/access`);
}
