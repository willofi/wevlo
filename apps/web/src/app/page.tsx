import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { LandingPage } from "@/components/landing/landing-page";
import { WorkspaceBootstrapSurface } from "@/components/workspace-bootstrap-surface";
import { getMe, listWorkspaces } from "@/lib/server-api";

export default async function Page() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <LandingPage />;
  }

  const [me, workspaces] = await Promise.all([
    getMe(),
    listWorkspaces()
  ]);

  return (
    <WorkspaceBootstrapSurface
      viewer={{
        avatarUrl: me.user.avatarUrl,
        email: me.user.email,
        name: me.user.name
      }}
      workspaces={workspaces}
    />
  );
}
