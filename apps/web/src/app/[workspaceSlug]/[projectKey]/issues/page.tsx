import { redirect } from "next/navigation";

type IssuesPageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function IssuesPage({ params }: IssuesPageProps) {
  const { projectKey, workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/${projectKey}?view=list`);
}
