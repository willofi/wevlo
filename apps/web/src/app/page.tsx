import { WorkspaceBootstrapSurface } from "@/components/workspace-bootstrap-surface";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { listWorkspaces } from "@/lib/server-api";

export default async function HomePage() {
  const [authSession, workspaces] = await Promise.all([
    requireCurrentAuthSession("/"),
    listWorkspaces()
  ]);

  return (
    <WorkspaceBootstrapSurface
      viewer={{
        email: authSession?.userEmail ?? null,
        name: authSession?.userName ?? "Workspace member"
      }}
      workspaces={workspaces}
    />
  );
}
