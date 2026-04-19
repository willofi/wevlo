import { redirect } from "next/navigation";

type NewIssuePageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function NewIssuePage({ params }: NewIssuePageProps) {
  const { projectKey, workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/${projectKey}?compose=1`);
}
