import { redirect } from "next/navigation";

type WorkspaceMyIssuesPageProps = {
  params: Promise<{
    workspaceSlug: string;
  }>;
};

export default async function WorkspaceMyIssuesPage({ params }: WorkspaceMyIssuesPageProps) {
  const { workspaceSlug } = await params;
  redirect(`/my-issues?workspace=${encodeURIComponent(workspaceSlug)}`);
}
