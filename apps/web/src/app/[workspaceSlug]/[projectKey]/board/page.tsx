import { redirect } from "next/navigation";

type BoardPageProps = {
  params: Promise<{
    projectKey: string;
    workspaceSlug: string;
  }>;
};

export default async function BoardPage({ params }: BoardPageProps) {
  const { projectKey, workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/${projectKey}?view=board`);
}
