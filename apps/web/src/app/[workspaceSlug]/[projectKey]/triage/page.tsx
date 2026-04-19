import { redirect } from "next/navigation";

type TriagePageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function TriagePage({ params }: TriagePageProps) {
  const { projectKey, workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/${projectKey}?view=list`);
}
