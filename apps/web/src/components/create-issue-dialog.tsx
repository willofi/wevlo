"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Calendar,
  Check,
  FolderKanban,
  Paperclip,
  Tag,
  UserCircle
} from "lucide-react";

import type {
  IssueDetailDto,
  IssueLabelDto,
  IssuePriority,
  IssueState,
  ProjectBoardColumnConfigDto,
  ProjectSummaryDto,
  WorkspaceMemberDto
} from "@wevlo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  MarkdownEditor,
  cn
} from "@wevlo/ui-web";

import { DropdownSearchInput, MetadataPill } from "@/components/issue-metadata-primitives";
import { notifyError, notifySuccess } from "@/lib/action-feedback";
import {
  buildProjectStateOptions,
  endOfWeek,
  getPriorityIcon,
  inDays,
  labelColorClasses,
  priorityOptions,
  renderProjectBoardIcon
} from "@/lib/issue-presentation";
import {
  createIssue,
  createProjectLabel,
  getProjectBoardConfig,
  getWorkspaceMemberHref,
  uploadIssueAttachment
} from "@/lib/issue-hub-data";
import { useProjectLabelsQuery } from "@/lib/query-hooks";
import { queryKeys } from "@/lib/query-keys";

type CreateIssueDialogProps = {
  initialState?: IssueState | undefined;
  onCreated: (issue: IssueDetailDto, projectKey: string, options?: { keepComposerOpen?: boolean }) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectKey?: string | undefined;
  projects: ProjectSummaryDto[];
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
};

export function CreateIssueDialog({
  initialState,
  onCreated,
  onOpenChange,
  open,
  projectKey,
  projects,
  workspaceMembers,
  workspaceSlug
}: CreateIssueDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<IssueState>(initialState ?? "backlog");
  const [priority, setPriority] = useState<IssuePriority>("none");
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [selectedProjectKey, setSelectedProjectKey] = useState(projectKey ?? "");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [createMore, setCreateMore] = useState(false);
  const [boardConfigColumns, setBoardConfigColumns] = useState<ProjectBoardColumnConfigDto[]>([]);
  const [stateSearch, setStateSearch] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const getWorkspaceMentionHref = useCallback(
    ({ userId }: { handle: string; userId: string }) => getWorkspaceMemberHref(workspaceSlug, userId),
    [workspaceSlug]
  );
  const labelsQuery = useProjectLabelsQuery(workspaceSlug, selectedProjectKey || undefined, {
    enabled: open && selectedProjectKey.length > 0
  });
  const labels = labelsQuery.data ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedProjectKey(projectKey ?? "");
    if (initialState) {
      setState(initialState);
    }
  }, [initialState, open, projectKey]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedProjectKey) {
      setBoardConfigColumns([]);
      setSelectedLabelIds([]);
      return;
    }

    let cancelled = false;

    const loadProjectMetadata = async () => {
      try {
        const nextBoardConfig = await getProjectBoardConfig(workspaceSlug, selectedProjectKey);

        if (!cancelled) {
          setBoardConfigColumns(nextBoardConfig.columns);
        }
      } catch {
        if (!cancelled) {
          setBoardConfigColumns([]);
          setSelectedLabelIds([]);
        }
      }
    };

    void loadProjectMetadata();

    return () => {
      cancelled = true;
    };
  }, [open, selectedProjectKey, workspaceSlug]);

  useEffect(() => {
    setSelectedLabelIds((current) => current.filter((labelId) => labels.some((label) => label.id === labelId)));
  }, [labels]);

  const selectedProject = projects.find((project) => project.key === selectedProjectKey);
  const selectedAssignee = workspaceMembers.find((member) => member.userId === assigneeUserId);
  const selectedLabels = labels.filter((label) => selectedLabelIds.includes(label.id));
  const stateOptions = buildProjectStateOptions(boardConfigColumns);
  const filteredStates = stateOptions.filter((option) => option.label.toLowerCase().includes(stateSearch.trim().toLowerCase()));
  const filteredMembers = workspaceMembers.filter((member) => {
    const needle = assigneeSearch.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return (
      member.user.name.toLowerCase().includes(needle) ||
      member.user.handle.toLowerCase().includes(needle)
    );
  });
  const filteredLabels = labels.filter((label) => {
    const needle = labelSearch.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return label.name.toLowerCase().includes(needle);
  });

  const reset = (options?: { keepProject?: boolean }) => {
    setTitle("");
    setDescription("");
    setState("backlog");
    setPriority("none");
    setAssigneeUserId(null);
    setSelectedLabelIds([]);
    setDueDate(null);
    setFiles([]);
    setStateSearch("");
    setAssigneeSearch("");
    setLabelSearch("");
    setNewLabelName("");
    setAttachmentError(null);

    if (!options?.keepProject) {
      setSelectedProjectKey(projectKey ?? "");
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      reset();
    }
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      return;
    }

    if (!selectedProjectKey) {
      notifyError(new Error("프로젝트를 먼저 선택해 주세요."), "Please select a project first.");
      return;
    }

    setAttachmentError(null);

    startTransition(() => {
      void (async () => {
        try {
          const created = await createIssue(workspaceSlug, selectedProjectKey, {
            assigneeUserId,
            description: description.trim(),
            dueDate,
            labelIds: selectedLabelIds,
            priority,
            state,
            targetProjectKey: selectedProjectKey,
            title: trimmedTitle
          });

          let attachmentFailure: string | null = null;

          for (const file of files) {
            try {
              await uploadIssueAttachment(workspaceSlug, selectedProjectKey, created.issueKey, file);
            } catch (uploadError) {
              attachmentFailure = uploadError instanceof Error ? uploadError.message : "Attachment upload failed.";
            }
          }

          if (attachmentFailure) {
            const message = `이슈 ${created.issueKey}는 생성됐지만 일부 첨부 업로드가 실패했습니다: ${attachmentFailure}`;
            setAttachmentError(message);
            notifyError(new Error(message), "Issue created, but some attachments failed.");
          } else {
            notifySuccess(`Issue ${created.issueKey} created.`);
          }

          onCreated(created, selectedProjectKey, attachmentFailure ? { keepComposerOpen: true } : undefined);

          if (createMore && !attachmentFailure) {
            reset({ keepProject: true });
            return;
          }

          if (!attachmentFailure) {
            reset();
          }
        } catch (submitError) {
          notifyError(submitError, "Issue creation failed.");
        }
      })();
    });
  };

  const handleCreateLabel = async () => {
    const trimmedName = newLabelName.trim();

    if (!trimmedName || isCreatingLabel) {
      return;
    }

    if (!selectedProjectKey) {
      notifyError(new Error("라벨을 추가하려면 프로젝트를 먼저 선택해 주세요."), "Please select a project before adding labels.");
      return;
    }

    setIsCreatingLabel(true);

    try {
      const createdLabel = await createProjectLabel(workspaceSlug, selectedProjectKey, {
        name: trimmedName
      });

      queryClient.setQueryData<IssueLabelDto[] | undefined>(
        queryKeys.project.labels(workspaceSlug, selectedProjectKey),
        (current) => {
          const next = current ?? [];
          const deduped = next.some((label) => label.id === createdLabel.id) ? next : [...next, createdLabel];
          return [...deduped].sort((left, right) => left.name.localeCompare(right.name));
        }
      );
      setSelectedLabelIds((current) => [...new Set([...current, createdLabel.id])]);
      setNewLabelName("");
      setLabelSearch("");
      notifySuccess(`Label "${createdLabel.name}" created.`);
    } catch (labelError) {
      notifyError(labelError, "Label creation failed.");
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) {
      return;
    }

    setFiles((current) => [...current, ...Array.from(fileList)]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showClose
        className="top-[calc(50%-100px)] w-[min(92vw,50rem)] gap-0 overflow-hidden rounded-[1.25rem] border-border/70 bg-background p-0 shadow-2xl"
      >
        <div className="grid min-h-[20rem] gap-6 px-6 pb-5 pt-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border/80 bg-background px-2.5 font-medium text-foreground">
              <FolderKanban className="size-3.5 text-primary" />
              {selectedProject?.key ?? selectedProjectKey}
            </span>
            <span className="text-base">›</span>
            <span className="text-sm font-medium text-foreground">New issue</span>
          </div>

            <div className="grid gap-3">
              <input
                autoFocus
                value={title}
                placeholder="Issue title"
                onChange={(event) => setTitle(event.target.value)}
                className="h-10 border-none bg-transparent p-0 text-[2rem] font-semibold tracking-normal text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <MarkdownEditor
                value={description}
                placeholder="Add description..."
                onChange={setDescription}
                workspaceMembers={workspaceMembers}
                getMentionHref={getWorkspaceMentionHref}
                editorClassName="min-h-[7rem] px-0 text-base"
                className="border-none bg-transparent shadow-none"
              />
            </div>

          <div className="mt-auto grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button">
                    <MetadataPill icon={renderProjectBoardIcon(stateOptions.find((option) => option.value === state)?.iconKey ?? "circle_dashed")}>
                      {stateOptions.find((option) => option.value === state)?.label ?? "Status"}
                    </MetadataPill>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-60">
                  <DropdownSearchInput placeholder="Search status..." value={stateSearch} onChange={setStateSearch} />
                  {filteredStates.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => setState(option.value)}>
                      <span className="mr-2 text-muted-foreground">{renderProjectBoardIcon(option.iconKey, "size-4")}</span>
                      {option.label}
                      {state === option.value ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                  {filteredStates.length === 0 ? <DropdownMenuItem disabled>No status found</DropdownMenuItem> : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button">
                    <MetadataPill icon={getPriorityIcon(priority)} muted={priority === "none"}>
                      {priorityOptions.find((option) => option.value === priority)?.label ?? "Priority"}
                    </MetadataPill>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                  {priorityOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => setPriority(option.value)}>
                      <span className="mr-2 text-muted-foreground">{getPriorityIcon(option.value)}</span>
                      {option.label}
                      {priority === option.value ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button">
                    <MetadataPill icon={<UserCircle className="size-3.5" />} muted={!selectedAssignee}>
                      {selectedAssignee?.user.name ?? "Assignee"}
                    </MetadataPill>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-60">
                  <DropdownSearchInput placeholder="Search assignee..." value={assigneeSearch} onChange={setAssigneeSearch} />
                  <DropdownMenuItem onSelect={() => setAssigneeUserId(null)}>
                    <UserCircle className="mr-2 size-4 text-muted-foreground" />
                    No assignee
                    {!assigneeUserId ? <Check className="ml-auto size-4" /> : null}
                  </DropdownMenuItem>
                  {filteredMembers.map((member) => (
                    <DropdownMenuItem key={member.userId} onSelect={() => setAssigneeUserId(member.userId)}>
                      <span className="mr-2 flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                        {member.user.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate">{member.user.name}</span>
                      {assigneeUserId === member.userId ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                  {filteredMembers.length === 0 ? <DropdownMenuItem disabled>No user found</DropdownMenuItem> : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button">
                    <MetadataPill icon={<FolderKanban className="size-3.5" />} muted={!selectedProject}>
                      {selectedProject?.key ?? "Project"}
                    </MetadataPill>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64">
                  {projects.map((project) => (
                    <DropdownMenuItem key={project.id} onSelect={() => setSelectedProjectKey(project.key)}>
                      <FolderKanban className="mr-2 size-4 text-muted-foreground" />
                      <span className="truncate">{project.key} · {project.name}</span>
                      {selectedProjectKey === project.key ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button">
                    <MetadataPill icon={<Tag className="size-3.5" />} muted={selectedLabels.length === 0}>
                      {selectedLabels.length > 0 ? selectedLabels.map((label) => label.name).join(", ") : "Labels"}
                    </MetadataPill>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-72">
                  <DropdownSearchInput placeholder="Search labels..." value={labelSearch} onChange={setLabelSearch} />
                  <div className="px-2 pb-2">
                    <div className="flex gap-2">
                      <input
                        value={newLabelName}
                        placeholder="Add new label..."
                        onChange={(event) => setNewLabelName(event.target.value)}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateLabel();
                          }
                        }}
                        className="h-8 w-full rounded-md border border-border/80 bg-background px-2 text-xs outline-none placeholder:text-muted-foreground"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        disabled={isCreatingLabel || newLabelName.trim().length === 0}
                        onClick={() => void handleCreateLabel()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {filteredLabels.length === 0 ? (
                    <DropdownMenuItem disabled>No label found</DropdownMenuItem>
                  ) : (
                    filteredLabels.map((label) => (
                      <DropdownMenuCheckboxItem
                        key={label.id}
                        checked={selectedLabelIds.includes(label.id)}
                        onCheckedChange={(checked) =>
                          setSelectedLabelIds((current) =>
                            checked ? [...new Set([...current, label.id])] : current.filter((labelId) => labelId !== label.id)
                          )
                        }
                        >
                        <span className={cn("mr-2 size-2 rounded-full", labelColorClasses[label.color] ?? "bg-slate-500")} />
                        {label.name}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button">
                    <MetadataPill icon={<Calendar className="size-3.5" />} muted={!dueDate}>
                      {dueDate ?? "Due date"}
                    </MetadataPill>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64">
                  <div className="px-2 py-2">
                    <input
                      type="date"
                      value={dueDate ?? ""}
                      onChange={(event) => setDueDate(event.target.value || null)}
                      className="h-8 w-full rounded-md border border-border/80 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDueDate(inDays(1))}>Tomorrow</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDueDate(endOfWeek())}>End of this week</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDueDate(inDays(7))}>In one week</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDueDate(null)}>No due date</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {files.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {files.map((file, index) => (
                  <button
                    key={`${file.name}-${index}`}
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
                    className="rounded-full border border-border/80 px-2.5 py-1 hover:bg-secondary"
                  >
                    {file.name}
                  </button>
                ))}
              </div>
            ) : null}

            {attachmentError ? <div className="text-sm text-destructive">{attachmentError}</div> : null}

            <div className="flex items-center justify-between gap-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => addFiles(event.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                  <span className="sr-only">Attach files</span>
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={createMore}
                    onChange={(event) => setCreateMore(event.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  Create more
                </label>
                <Button disabled={isPending || title.trim().length === 0} onClick={handleSubmit} className="h-9 rounded-full px-4 text-sm">
                  {isPending ? "Creating..." : "Create issue"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
