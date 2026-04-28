import { permanentRedirect } from "next/navigation";

type MembersPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function MembersPage({ params }: MembersPageProps) {
  const { workspaceSlug } = await params;
  permanentRedirect(`/${workspaceSlug}/settings/members`);
}
