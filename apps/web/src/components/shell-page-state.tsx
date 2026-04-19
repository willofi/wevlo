import Link from "next/link";

import { getOptionalAppShellData } from "@/lib/app-shell-data";
import { AppShell } from "@/components/app-shell";
import { PageState, pageStateButtonClassName, type PageStateTone } from "@/components/page-state";

type ShellPageStateProps = {
  actionHref?: string;
  actionLabel?: string;
  body: string;
  breadcrumbs?: Array<{
    href?: string;
    label: string;
  }>;
  currentWorkspaceSlug?: string;
  eyebrow?: string;
  shellSubtitle?: string;
  shellTitle?: string;
  title: string;
  tone?: PageStateTone;
};

export async function ShellPageState({
  actionHref = "/",
  actionLabel = "Go home",
  body,
  breadcrumbs = [
    { label: "Home", href: "/" },
    { label: "Status" }
  ],
  currentWorkspaceSlug,
  eyebrow,
  shellSubtitle = "Use the workspace shell to recover quickly without losing your place.",
  shellTitle,
  title,
  tone = "neutral"
}: ShellPageStateProps) {
  const shellData = await getOptionalAppShellData();

  return (
    <AppShell
      viewer={shellData.viewer}
      workspaces={shellData.workspaces}
      {...(currentWorkspaceSlug ? { currentWorkspaceSlug } : {})}
      title={shellTitle ?? title}
      subtitle={shellSubtitle}
      breadcrumbs={breadcrumbs}
    >
      <PageState
        tone={tone}
        title={title}
        body={body}
        {...(eyebrow ? { eyebrow } : {})}
        actions={
          <Link href={actionHref} className={pageStateButtonClassName}>
            {actionLabel}
          </Link>
        }
      />
    </AppShell>
  );
}
