import { permanentRedirect } from "next/navigation";

type WorkspaceAccessPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceAccessPage({ params }: WorkspaceAccessPageProps) {
  const { workspaceSlug } = await params;
  permanentRedirect(`/${workspaceSlug}/settings/access`);
}
