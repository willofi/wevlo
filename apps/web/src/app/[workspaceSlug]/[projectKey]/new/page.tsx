import { redirect } from "next/navigation";

type NewProjectIssuePageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function NewProjectIssuePage({ params }: NewProjectIssuePageProps) {
  const { projectKey, workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/${projectKey}?compose=1`);
}
