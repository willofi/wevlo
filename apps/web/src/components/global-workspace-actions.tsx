"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderKanban, ListTodo, Loader2, Search, SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";

import type {
  IssueDetailDto,
  ProjectSummaryDto,
  WorkspaceMemberDto,
  WorkspaceSearchResponseDto,
  WorkspaceSearchScope
} from "@wevlo/contracts";
import { Button, Dialog, DialogContent, Input, ScrollArea, Tabs, TabsList, TabsTrigger, cn } from "@wevlo/ui-web";

import { CreateIssueDialog } from "@/components/create-issue-dialog";
import { getIssueHref, getProjectHref, searchWorkspace } from "@/lib/issue-hub-data";

export type WorkspaceActionsContext = {
  currentProjectKey?: string;
  projects: ProjectSummaryDto[];
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
};

type GlobalWorkspaceActionsProps = WorkspaceActionsContext & {
  variant?: "header" | "sidebar";
};

const emptyResults: WorkspaceSearchResponseDto = {
  documents: [],
  issues: [],
  projects: []
};

function WorkspaceSearchDialog({
  onOpenChange,
  open,
  workspaceSlug
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<WorkspaceSearchScope>("all");
  const [results, setResults] = useState<WorkspaceSearchResponseDto>(emptyResults);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setScope("all");
      setResults(emptyResults);
      setIsLoading(false);
      return;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length === 0) {
      setResults(emptyResults);
      setIsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      void searchWorkspace(workspaceSlug, { q: trimmedQuery, scope })
        .then((response) => {
          setResults(response);
        })
        .catch(() => {
          setResults(emptyResults);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 140);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open, query, scope, workspaceSlug]);

  const hasResults = results.issues.length > 0 || results.projects.length > 0 || results.documents.length > 0;

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="top-[10vh] translate-y-0 overflow-hidden rounded-[1.1rem] border-border/70 bg-background p-0 shadow-2xl sm:max-w-[min(96vw,64rem)]"
      >
        <div className="grid min-h-[32rem] grid-rows-[auto_auto_minmax(0,1fr)]">
          <div className="border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <Search className="size-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="이슈, 프로젝트, 문서 검색"
                className="h-auto border-0 bg-transparent px-0 py-0 text-base shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="border-b border-border/70 px-4 py-3">
            <Tabs value={scope} onValueChange={(value) => setScope(value as WorkspaceSearchScope)}>
              <TabsList className="h-auto gap-1 rounded-full bg-transparent p-0">
                <TabsTrigger value="all" className="rounded-full px-3 py-1.5 text-xs">All</TabsTrigger>
                <TabsTrigger value="issues" className="rounded-full px-3 py-1.5 text-xs">Issues</TabsTrigger>
                <TabsTrigger value="projects" className="rounded-full px-3 py-1.5 text-xs">Projects</TabsTrigger>
                <TabsTrigger value="documents" className="rounded-full px-3 py-1.5 text-xs">Documents</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="min-h-0">
            <div className="grid gap-6 px-4 py-4">
              {isLoading ? (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  검색 중...
                </div>
              ) : query.trim().length === 0 ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                  이슈 키, 프로젝트 키, 이름으로 검색하세요.
                </div>
              ) : scope === "documents" ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                  Documents는 다음 단계에서 연결할 예정입니다.
                </div>
              ) : !hasResults ? (
                <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                  검색 결과가 없습니다.
                </div>
              ) : (
                <>
                  {(scope === "all" || scope === "projects") && results.projects.length > 0 ? (
                    <section className="grid gap-2">
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Projects</div>
                      <div className="grid gap-1">
                        {results.projects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => navigate(getProjectHref(workspaceSlug, project.key))}
                            className="flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary/65"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                                <FolderKanban className="size-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
                                <div className="truncate text-xs text-muted-foreground">{project.key}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {(scope === "all" || scope === "issues") && results.issues.length > 0 ? (
                    <section className="grid gap-2">
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Issues</div>
                      <div className="grid gap-1">
                        {results.issues.map((issue) => (
                          <button
                            key={issue.id}
                            type="button"
                            onClick={() => navigate(getIssueHref(workspaceSlug, issue.projectKey, issue.issueKey))}
                            className="flex items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-secondary/65"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                                <ListTodo className="size-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-foreground">{issue.title}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {issue.issueKey} · {issue.projectKey}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted-foreground">{new Date(issue.updatedAt).toLocaleDateString("ko-KR")}</div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {scope === "all" ? (
                    <section className="grid gap-2">
                      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Documents</div>
                      <div className="rounded-xl border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                        Documents는 아직 검색 결과를 제공하지 않습니다.
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GlobalWorkspaceActions({
  currentProjectKey,
  projects,
  variant = "header",
  workspaceMembers,
  workspaceSlug
}: GlobalWorkspaceActionsProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const triggerClassName = useMemo(
    () =>
      variant === "sidebar"
        ? "size-4 border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
        : "h-9 rounded-full border-border/80 bg-background/80 px-3 text-muted-foreground hover:text-foreground",
    [variant]
  );

  const handleCreated = (issue: IssueDetailDto, projectKey: string, options?: { keepComposerOpen?: boolean }) => {
    if (options?.keepComposerOpen) {
      router.refresh();
      return;
    }

    setIsCreateOpen(false);
    router.push(getIssueHref(workspaceSlug, projectKey, issue.issueKey));
    router.refresh();
  };

  return (
    <>
      <div className={cn("flex items-center gap-1", variant === "sidebar" ? "ml-auto shrink-0" : "gap-2")}>
        <Button
          type="button"
          variant={variant === "sidebar" ? "ghost" : "outline"}
          size={variant === "sidebar" ? "icon" : "sm"}
          className={triggerClassName}
          onClick={() => setIsSearchOpen(true)}
          title="Search"
          aria-label="Search"
        >
          <Search className="size-4" />
          {variant === "header" ? (
            <>
              <span>Search</span>
              <span className="ml-2 hidden text-[11px] text-muted-foreground lg:inline-flex">⌘K</span>
            </>
          ) : null}
        </Button>
        <Button
          type="button"
          variant={variant === "sidebar" ? "ghost" : "default"}
          size="icon"
          className={cn(
            "rounded-full",
            variant === "sidebar"
              ? "size-4 border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
              : "size-9"
          )}
          onClick={() => setIsCreateOpen(true)}
          title="New issue"
          aria-label="New issue"
        >
          <SquarePen className="size-4" />
        </Button>
      </div>

      <WorkspaceSearchDialog
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        workspaceSlug={workspaceSlug}
      />

      <CreateIssueDialog
        onCreated={handleCreated}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
        projectKey={currentProjectKey}
        projects={projects}
        workspaceMembers={workspaceMembers}
        workspaceSlug={workspaceSlug}
      />
    </>
  );
}
