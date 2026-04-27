import { WorkspaceBootstrapSurface } from "@/components/workspace-bootstrap-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getMe, listWorkspaces } from "@/lib/server-api";

export default async function HomePage() {
  const [, me, workspaces] = await Promise.all([
    requireCurrentAuthSession("/"),
    getMe(),
    listWorkspaces()
  ]);

  return (
    <WorkspaceBootstrapSurface
      viewer={{
        email: me.user.email,
        name: me.user.name
      }}
      workspaces={workspaces}
    />
  );
}
