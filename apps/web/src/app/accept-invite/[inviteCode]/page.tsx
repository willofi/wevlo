import { permanentRedirect } from "next/navigation";

type InviteAliasPageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

export default async function InviteAliasPage({ params }: InviteAliasPageProps) {
  const { inviteCode } = await params;
  permanentRedirect(`/invite/${inviteCode}`);
}
