import { permanentRedirect } from "next/navigation";

type ProjectBoardSettingsPageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function ProjectBoardSettingsPage({ params }: ProjectBoardSettingsPageProps) {
  const { projectKey, workspaceSlug } = await params;
  permanentRedirect(`/${workspaceSlug}/${projectKey}/board?customize=1`);
}
