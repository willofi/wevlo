import { redirect } from "next/navigation";

import { getSession, listWorkspaces } from "@/lib/server-api";

export default async function GlobalMyIssuesPage() {
  const [session, workspaces] = await Promise.all([
    getSession(),
    listWorkspaces()
  ]);
  const workspaceSlug = session.defaultWorkspaceSlug ?? workspaces[0]?.slug;

  if (!workspaceSlug) {
    redirect("/");
  }

  redirect(`/${workspaceSlug}/my-issues`);
}
