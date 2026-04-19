"use client";

import Link from "next/link";
import { Expand, PanelRightClose } from "lucide-react";

import type { IssueDetailDto, WorkspaceMemberDto } from "@wevlo/contracts";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@wevlo/ui-web";

import { getIssueHref } from "@/lib/issue-hub-data";
import type { UserDirectory } from "@/lib/user-directory";
import { IssueDetailEditor } from "@/components/issue-detail-editor";

type IssueDetailInspectorProps = {
  issue?: IssueDetailDto;
  onClose: () => void;
  onIssueUpdated: (issue: IssueDetailDto) => void;
  projectKey: string;
  userDirectory?: UserDirectory;
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
};

export function IssueDetailInspector({
  issue,
  onClose,
  onIssueUpdated,
  projectKey,
  userDirectory = {},
  workspaceMembers,
  workspaceSlug
}: IssueDetailInspectorProps) {
  return (
    <Sheet open={Boolean(issue)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showClose={false} className="w-[min(94vw,46rem)] max-w-none gap-0 p-0">
        {issue ? (
          <>
            <SheetHeader className="border-b border-border/80 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <SheetTitle className="text-base font-semibold">{issue.issueKey}</SheetTitle>
                  <SheetDescription>
                    Quick inspection and lightweight edits without leaving the project shell.
                  </SheetDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="icon" variant="outline">
                    <Link href={getIssueHref(workspaceSlug, projectKey, issue.issueKey)}>
                      <Expand className="size-4" />
                      <span className="sr-only">Open full issue page</span>
                    </Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close issue drawer">
                    <PanelRightClose className="size-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>
            <div className="min-h-0 flex-1 px-6 py-6">
              <IssueDetailEditor
                issue={issue}
                mode="drawer"
                onIssueUpdated={onIssueUpdated}
                projectKey={projectKey}
                userDirectory={userDirectory}
                workspaceMembers={workspaceMembers}
                workspaceSlug={workspaceSlug}
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
