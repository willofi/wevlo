import { MyIssuesSurface } from "@/components/my-issues-surface";
import { getAppShellData } from "@/lib/app-shell-data";
import { listWorkspaces } from "@/lib/server-api";

type GlobalMyIssuesPageProps = {
  searchParams: Promise<{
    project?: string;
    tab?: "activity" | "assigned" | "created" | "subscribed";
    workspace?: string;
  }>;
};

export default async function GlobalMyIssuesPage({ searchParams }: GlobalMyIssuesPageProps) {
  const [params, shellData, workspaces] = await Promise.all([
    searchParams,
    getAppShellData(),
    listWorkspaces()
  ]);

  return (
    <MyIssuesSurface
      {...(params.project ? { initialProjectKey: params.project } : {})}
      {...(params.tab ? { initialTab: params.tab } : {})}
      {...(params.workspace ? { initialWorkspaceSlug: params.workspace } : {})}
      viewer={shellData.viewer}
      workspaces={workspaces}
    />
  );
}
