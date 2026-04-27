"use client";

import Link from "next/link";
import { ArrowUpRight, PanelRightClose } from "lucide-react";

import type { IssueDetailDto, WorkspaceMemberDto } from "@wevlo/contracts";
import { Button, ScrollArea, Sheet, SheetContent, SheetDescription, SheetTitle } from "@wevlo/ui-web";

import { getIssueHref } from "@/lib/issue-hub-data";
import type { UserDirectory } from "@/lib/user-directory";
import { IssueDetailEditor } from "@/components/issue-detail-editor";

type IssueDetailInspectorProps = {
  issue?: IssueDetailDto;
  onClose: () => void;
  onIssueUpdated: (issue: IssueDetailDto) => void;
  projectKey: string;
  userDirectory?: UserDirectory;
  viewerUserId: string;
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
};

export function IssueDetailInspector({
  issue,
  onClose,
  onIssueUpdated,
  projectKey,
  userDirectory = {},
  viewerUserId,
  workspaceMembers,
  workspaceSlug
}: IssueDetailInspectorProps) {
  return (
    <Sheet open={Boolean(issue)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" showClose={false} className="w-[min(94vw,56rem)] max-w-none gap-0 overflow-hidden border-l border-border/50 p-0">
        {issue ? (
          <>
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/45 px-6 py-4">
              <div className="min-w-0">
                <SheetTitle className="sr-only">{issue.issueKey}: {issue.title}</SheetTitle>
                <SheetDescription className="sr-only">Issue details and activity for {issue.issueKey}</SheetDescription>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{issue.issueKey}</div>
                <div className="truncate text-sm font-medium text-foreground">{issue.title}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link href={getIssueHref(workspaceSlug, projectKey, issue.issueKey)}>
                    Open
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
                <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close issue drawer">
                  <PanelRightClose className="size-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-6 py-6">
                <IssueDetailEditor
                  issue={issue}
                  mode="drawer"
                  onIssueUpdated={onIssueUpdated}
                  projectKey={projectKey}
                  userDirectory={userDirectory}
                  viewerUserId={viewerUserId}
                  workspaceMembers={workspaceMembers}
                  workspaceSlug={workspaceSlug}
                />
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
