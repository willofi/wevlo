"use client";

import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useQueryClient } from "@tanstack/react-query";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, useCallback, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellOff,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  CornerDownRight,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  MoreHorizontal,
  Minus,
  Paperclip,
  Pencil,
  Plus,
  Link as LinkIcon,
  SmilePlus,
  Tag,
  Trash2,
  UserRound
} from "lucide-react";

import type {
  IssueActivityItemDto,
  IssueCommentDto,
  IssueDetailDto,
  IssueLabelDto,
  IssuePriority,
  IssueReferenceDto,
  IssueState,
  ProjectBoardColumnConfigDto,
  WorkspaceMemberDto
} from "@wevlo/contracts";
import {
  Avatar,
  AvatarFallback,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  MarkdownEditor,
  MarkdownViewer,
  cn
} from "@wevlo/ui-web";

import { DropdownSearchInput } from "@/components/issue-metadata-primitives";
import { ProjectBoardSettingsEditor } from "@/components/project-board-settings-editor";
import {
  createProjectLabel,
  createComment,
  createIssue,
  deleteIssueAttachment,
  getIssueActivity,
  getIssueAttachmentHref,
  getIssueByKey,
  getIssueHref,
  getIssueSubscription,
  getProjectBoardConfig,
  setIssueReaction,
  setCommentReaction,
  setIssueSubscription,
  transitionIssue,
  updateProjectBoardConfig,
  updateIssue,
  uploadIssueAttachment,
  getMe,
  getWorkspaceMemberHref
} from "@/lib/issue-hub-data";
import { useProjectLabelsQuery } from "@/lib/query-hooks";
import { queryKeys } from "@/lib/query-keys";
import {
  buildProjectStateOptions,
  endOfWeek,
  getPriorityIcon,
  getProjectStatePresentation,
  inDays,
  labelColorClasses,
  priorityOptions,
  renderProjectBoardIcon,
  TripleChevronUp
} from "@/lib/issue-presentation";
import type { UserDirectory } from "@/lib/user-directory";
import { getDirectoryUserLabel } from "@/lib/user-directory";

type IssueDetailEditorProps = {
  issue: IssueDetailDto;
  mode: "drawer" | "page";
  onIssueUpdated: (issue: IssueDetailDto) => void;
  projectKey: string;
  userDirectory?: UserDirectory;
  viewerUserId: string;
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
};

const priorityLabel = Object.fromEntries(priorityOptions.map((option) => [option.value, option.label])) as Record<IssuePriority, string>;

const labelColorMap: Record<string, string> = {
  blue: "#4f9cf5",
  gray: "#8a8f98",
  green: "#2ea043",
  orange: "#f78166",
  red: "#f85149",
  violet: "#8957e5",
  yellow: "#d29922"
};

const getLabelColor = (color: string) => labelColorMap[color] ?? color;

const contentAutosaveDelayMs = 2000;
const contentAutosaveRetryDelayMs = 5000;

const normalizeContent = (value: string) => value.trim().replace(/\r\n/g, "\n");

export function IssueDetailEditor({
  issue,
  mode,
  onIssueUpdated,
  projectKey,
  userDirectory = {},
  viewerUserId,
  workspaceMembers,
  workspaceSlug
}: IssueDetailEditorProps) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDeleteAttachment = async (attachmentId: string) => {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          await deleteIssueAttachment(workspaceSlug, projectKey, issue.issueKey, attachmentId);
          
          const updated = await getIssueByKey(workspaceSlug, projectKey, issue.issueKey);
          if (updated) {
            onIssueUpdated(updated);
          }
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : "파일 삭제에 실패했습니다.");
        }
      })();
    });
  };

  const handleUploadAttachment = async (files: File[]) => {
    if (files.length === 0) return;

    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const newAttachments: string[] = [];
          for (const file of files) {
            const attachment = await uploadIssueAttachment(workspaceSlug, projectKey, issue.issueKey, file);
            const href = getIssueAttachmentHref(workspaceSlug, projectKey, issue.issueKey, attachment.id);
            
            if (attachment.contentType.startsWith("image/")) {
              newAttachments.push(`\n![${attachment.fileName}](${href})`);
            } else {
              newAttachments.push(`\n[${attachment.fileName}](${href})`);
            }
          }
          
          if (newAttachments.length > 0) {
            handleDraftDescriptionChange(draftDescription + newAttachments.join(""));
          }

          const updated = await getIssueByKey(workspaceSlug, projectKey, issue.issueKey);
          if (updated) {
            onIssueUpdated(updated);
          }
        } catch (attachError) {
          setError(attachError instanceof Error ? attachError.message : "파일 업로드에 실패했습니다.");
        }
      })();
    });
  };
  const autosaveTimerRef = useRef<number | null>(null);
  const latestContentDraftRef = useRef({ description: issue.description, title: issue.title });
  const savedContentRef = useRef({ description: issue.description, title: issue.title });
  const isContentSaveInFlightRef = useRef(false);
  const contentSaveRequestedDuringFlightRef = useRef(false);
  const contentDraftVersionRef = useRef(0);
  const contentSaveSequenceRef = useRef(0);

  const [draftTitle, setDraftTitle] = useState(issue.title);
  const [draftDescription, setDraftDescription] = useState(issue.description);
  const [commentBody, setCommentBody] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [subIssueTitle, setSubIssueTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const isDescriptionHighlighted = false;
  const [isPending, startTransition] = useTransition();
  const [isSubscriptionPending, setIsSubscriptionPending] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [resolvedCommentIds, setResolvedCommentIds] = useState<Set<string>>(new Set());
  const [resolvedViewerUserId, setResolvedViewerUserId] = useState(viewerUserId);
  const [activityItems, setActivityItems] = useState<IssueActivityItemDto[]>([]);
  const [boardConfigColumns, setBoardConfigColumns] = useState<ProjectBoardColumnConfigDto[]>([]);
  const [stateSearch, setStateSearch] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [labelSearch, setLabelSearch] = useState("");
  const [newLabelName, setNewLabelName] = useState("");
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [isStatusSettingsOpen, setIsStatusSettingsOpen] = useState(false);
  const [draftBoardConfigColumns, setDraftBoardConfigColumns] = useState<ProjectBoardColumnConfigDto[]>([]);
  const [isSavingBoardConfig, setIsSavingBoardConfig] = useState(false);
  const projectLabelsQuery = useProjectLabelsQuery(workspaceSlug, projectKey);
  const projectLabels = projectLabelsQuery.data ?? [];

  useEffect(() => {
    if (normalizeContent(issue.description) === normalizeContent(savedContentRef.current.description) &&
        issue.title === savedContentRef.current.title) {
      return;
    }

    const latestDraft = latestContentDraftRef.current;
    const serverContentMatchesDraft =
      normalizeContent(latestDraft.description) === normalizeContent(issue.description) &&
      latestDraft.title === issue.title;

    if (serverContentMatchesDraft) {
      setDraftTitle(issue.title);
      setDraftDescription(issue.description);
      setIsAutosaving(false);
    }
    
    savedContentRef.current = {
      description: issue.description,
      title: issue.title
    };
  }, [issue.description, issue.id, issue.title]);

  useEffect(() => {
    latestContentDraftRef.current = {
      description: draftDescription,
      title: draftTitle
    };
  }, [draftDescription, draftTitle]);

  const hasUnsavedContent = useCallback(() => {
    const nextDraft = latestContentDraftRef.current;
    const savedDraft = savedContentRef.current;

    return normalizeContent(nextDraft.title) !== normalizeContent(savedDraft.title) || 
           normalizeContent(nextDraft.description) !== normalizeContent(savedDraft.description);
  }, []);

  const flushContentSave = useCallback(async (options?: { keepalive?: boolean }) => {
    const nextDraft = latestContentDraftRef.current;
    const savedDraft = savedContentRef.current;

    const changes: Partial<{ description: string; title: string }> = {};
    if (normalizeContent(nextDraft.title) !== normalizeContent(savedDraft.title)) {
      changes.title = nextDraft.title;
    }
    if (normalizeContent(nextDraft.description) !== normalizeContent(savedDraft.description)) {
      changes.description = nextDraft.description;
    }

    if (Object.keys(changes).length === 0) {
      setIsAutosaving(false);
      return;
    }

    if (isContentSaveInFlightRef.current) {
      contentSaveRequestedDuringFlightRef.current = true;
      setIsAutosaving(true);
      return;
    }

    isContentSaveInFlightRef.current = true;
    setIsAutosaving(true);
    let saveFailed = false;
    const saveSequence = contentSaveSequenceRef.current + 1;
    const draftVersionAtRequest = contentDraftVersionRef.current;
    contentSaveSequenceRef.current = saveSequence;

    try {
      const updated = await updateIssue(workspaceSlug, projectKey, issue.issueKey, changes, options?.keepalive ? { keepalive: true } : undefined);
      
      const isLatestSaveResponse = saveSequence === contentSaveSequenceRef.current;

      if (isLatestSaveResponse) {
        savedContentRef.current = {
          description: updated.description,
          title: updated.title
        };
        onIssueUpdated(updated);
        setError(null);
      }

      if (contentDraftVersionRef.current !== draftVersionAtRequest) {
        contentSaveRequestedDuringFlightRef.current = true;
      }
    } catch (autosaveError) {
      saveFailed = true;
      setError(autosaveError instanceof Error ? autosaveError.message : "자동 저장에 실패했습니다.");
      contentSaveRequestedDuringFlightRef.current = false;
      setIsAutosaving(false);
    } finally {
      isContentSaveInFlightRef.current = false;
      const shouldRetry = !saveFailed && (contentSaveRequestedDuringFlightRef.current || hasUnsavedContent());
      if (shouldRetry) {
        contentSaveRequestedDuringFlightRef.current = false;
        
        if (autosaveTimerRef.current) {
          window.clearTimeout(autosaveTimerRef.current);
        }

        autosaveTimerRef.current = window.setTimeout(() => {
          autosaveTimerRef.current = null;
          void flushContentSave();
        }, contentAutosaveRetryDelayMs);
      } else if (!saveFailed) {
        setIsAutosaving(false);
      }
    }
  }, [issue.issueKey, onIssueUpdated, projectKey, workspaceSlug, hasUnsavedContent]);

  const flushContentSaveNow = useCallback((options?: { keepalive?: boolean }) => {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    return flushContentSave(options);
  }, [flushContentSave]);

  useEffect(() => {
    return () => {
      if (hasUnsavedContent()) {
        void flushContentSaveNow({ keepalive: true });
      }

      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [flushContentSaveNow, hasUnsavedContent]);

  const handleDraftTitleChange = useCallback((nextTitle: string) => {
    contentDraftVersionRef.current += 1;
    latestContentDraftRef.current = {
      ...latestContentDraftRef.current,
      title: nextTitle
    };
    setDraftTitle(nextTitle);
  }, []);

  const handleDraftDescriptionChange = useCallback((nextDescription: string) => {
    contentDraftVersionRef.current += 1;
    latestContentDraftRef.current = {
      ...latestContentDraftRef.current,
      description: nextDescription
    };
    setDraftDescription(nextDescription);
  }, []);

  useEffect(() => {
    if (!hasUnsavedContent()) {
      if (!isContentSaveInFlightRef.current) {
        setIsAutosaving(false);
      }
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    setIsAutosaving(true);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void flushContentSave();
    }, contentAutosaveDelayMs);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [draftDescription, draftTitle, flushContentSave, hasUnsavedContent]);

  useEffect(() => {
    setResolvedViewerUserId(viewerUserId);
  }, [viewerUserId]);

  useEffect(() => {
    let cancelled = false;

    const loadViewer = async () => {
      try {
        const me = await getMe();

        if (!cancelled) {
          setResolvedViewerUserId(me.user.id);
        }
      } catch {
        if (!cancelled) {
          setResolvedViewerUserId(viewerUserId);
        }
      }
    };

    void loadViewer();

    return () => {
      cancelled = true;
    };
  }, [viewerUserId]);

  useEffect(() => {
    let cancelled = false;

    const loadProjectMetadata = async () => {
      try {
        const boardConfig = await getProjectBoardConfig(workspaceSlug, projectKey);

        if (!cancelled) {
          setBoardConfigColumns(boardConfig.columns);
          setDraftBoardConfigColumns(boardConfig.columns);
        }
      } catch (error) {
        console.error("Failed to load project metadata:", error);
      }
    };

    void loadProjectMetadata();

    return () => {
      cancelled = true;
    };
  }, [projectKey, workspaceSlug]);

  useEffect(() => {
    let cancelled = false;

    const loadActivity = async () => {
      try {
        const items = await getIssueActivity(workspaceSlug, projectKey, issue.issueKey);

        if (!cancelled) {
          setActivityItems(items);
        }
      } catch (error) {
        console.error("Failed to load activity:", error);
      }
    };

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [issue.issueKey, issue.updatedAt, projectKey, workspaceSlug]);

  useEffect(() => {
    let cancelled = false;

    const loadSubscription = async () => {
      try {
        const state = await getIssueSubscription(workspaceSlug, projectKey, issue.issueKey);

        if (!cancelled) {
          setIsSubscribed(state.subscribed);
        }
      } catch (error) {
        console.error("Failed to load subscription:", error);
      }
    };

    void loadSubscription();

    return () => {
      cancelled = true;
    };
  }, [issue.issueKey, projectKey, workspaceSlug]);

  useEffect(() => {
    if (searchParams.get("target") !== "description") {
      return;
    }

    const targetKind = searchParams.get("target");
    const targetCommentId = searchParams.get("comment");

    if (targetKind === "comment" && targetCommentId) {
      setHighlightedCommentId(targetCommentId);
      commentRefs.current[targetCommentId]?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      const timer = window.setTimeout(() => {
        setHighlightedCommentId((current) => (current === targetCommentId ? null : current));
      }, 2200);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [issue.id, mode, searchParams]);

  const comments = useMemo(
    () => [...issue.comments].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)),
    [issue.comments]
  );
  const stateOptions = useMemo(() => buildProjectStateOptions(boardConfigColumns), [boardConfigColumns]);
  const currentStatePresentation = getProjectStatePresentation(issue.state, boardConfigColumns);
  const getWorkspaceMentionHref = useCallback(
    ({ userId }: { handle: string; userId: string }) => getWorkspaceMemberHref(workspaceSlug, userId),
    [workspaceSlug]
  );
  const selectedAssignee = workspaceMembers.find((member) => member.userId === issue.assigneeUserId);
  const filteredStates = stateOptions.filter((option) => option.label.toLowerCase().includes(stateSearch.trim().toLowerCase()));
  const filteredMembers = workspaceMembers.filter((member) => {
    const needle = assigneeSearch.trim().toLowerCase();

    if (!needle) {
      return true;
    }

    return member.user.name.toLowerCase().includes(needle) || member.user.handle.toLowerCase().includes(needle);
  });
  const filteredLabels = projectLabels.filter((label) => label.name.toLowerCase().includes(labelSearch.trim().toLowerCase()));

  const perform = async <T,>(action: () => Promise<T>, errorMessage: string): Promise<T | undefined> => {
    setError(null);

    try {
      const result = await action();
      if (result && typeof result === "object" && "id" in result && (result as any).id === issue.id) {
        onIssueUpdated(result as unknown as IssueDetailDto);
      }
      return result;
    } catch (actionError) {
      setError(autosaveErrorToMessage(actionError, errorMessage));
      return undefined;
    }
  };

  const autosaveErrorToMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  };

  const handleToggleResolve = (commentId: string) => {
    setResolvedCommentIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleStateChange = (nextState: IssueState) => {
    void perform(
      () =>
        transitionIssue(workspaceSlug, projectKey, issue.issueKey, {
          state: nextState
        }),
      "상태 변경에 실패했습니다."
    );
  };

  const handlePriorityChange = (nextPriority: IssuePriority) => {
    void perform(
      () =>
        updateIssue(workspaceSlug, projectKey, issue.issueKey, {
          priority: nextPriority
        }),
      "우선순위 변경에 실패했습니다."
    );
  };

  const handleAssigneeChange = (nextAssignee: string | "unassigned") => {
    void perform(
      () =>
        updateIssue(workspaceSlug, projectKey, issue.issueKey, {
          assigneeUserId: nextAssignee === "unassigned" ? null : nextAssignee
        }),
      "담당자 변경에 실패했습니다."
    );
  };

  const handleDueDateChange = (nextDueDate: string | null) => {
    void perform(
      () =>
        updateIssue(workspaceSlug, projectKey, issue.issueKey, {
          dueDate: nextDueDate || null
        }),
      "마감일 변경에 실패했습니다."
    );
  };

  const handleLabelChange = (nextLabelIds: string[]) => {
    void perform(
      () =>
        updateIssue(workspaceSlug, projectKey, issue.issueKey, {
          labelIds: nextLabelIds
        }),
      "라벨 변경에 실패했습니다."
    );
  };

  const handleCreateLabel = async () => {
    const trimmedName = newLabelName.trim();

    if (!trimmedName || isCreatingLabel) {
      return;
    }

    setError(null);
    setIsCreatingLabel(true);

    try {
      const createdLabel = await createProjectLabel(workspaceSlug, projectKey, {
        name: trimmedName
      });

      queryClient.setQueryData<IssueLabelDto[] | undefined>(
        queryKeys.project.labels(workspaceSlug, projectKey),
        (current) => {
          const next = current ?? [];
          const deduped = next.some((label) => label.id === createdLabel.id) ? next : [...next, createdLabel];
          return [...deduped].sort((left, right) => left.name.localeCompare(right.name));
        }
      );
      
      const nextLabelIds = [...new Set([...issue.labels.map(l => l.id), createdLabel.id])];
      handleLabelChange(nextLabelIds);
      
      setNewLabelName("");
      setLabelSearch("");
    } catch (labelError) {
      setError(labelError instanceof Error ? labelError.message : "Label creation failed.");
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const handleCreateComment = (parentCommentId?: string | null) => {
    const body = parentCommentId ? replyBody : commentBody;
    if (body.trim().length === 0 && commentFiles.length === 0) {
      return;
    }

    setError(null);
    setIsCommentSubmitting(true);

    startTransition(() => {
      void (async () => {
        try {
          const updated = await createComment(workspaceSlug, projectKey, issue.issueKey, {
            body,
            parentCommentId: parentCommentId ?? null
          });

          if (parentCommentId) {
            setReplyBody("");
            setReplyToCommentId(null);
          } else {
            setCommentBody("");
            setCommentFiles([]);
          }
          onIssueUpdated(updated);
        } catch (commentError) {
          setError(commentError instanceof Error ? commentError.message : "코멘트 작성에 실패했습니다.");
        } finally {
          setIsCommentSubmitting(false);
        }
      })();
    });
  };

  const handleCommentReactionToggle = (commentId: string, emoji: string) => {
    const comment = issue.comments.find((c) => c.id === commentId);
    if (!comment) return;

    const existing = comment.reactions.find((reaction) => reaction.emoji === emoji);
    const active = existing?.userIds.includes(resolvedViewerUserId) ?? false;

    void perform(
      () =>
        setCommentReaction(workspaceSlug, projectKey, issue.issueKey, commentId, {
          active: !active,
          emoji
        }),
      "댓글 리액션 반영에 실패했습니다."
    );
  };

  const handleReactionToggle = (emoji: string) => {
    const existing = issue.reactions.find((reaction) => reaction.emoji === emoji);
    const active = existing?.userIds.includes(resolvedViewerUserId) ?? false;

    void perform(
      () =>
        setIssueReaction(workspaceSlug, projectKey, issue.issueKey, {
          active: !active,
          emoji
        }),
      "리액션 반영에 실패했습니다."
    );
  };

  const handleSubscriptionToggle = async () => {
    setIsSubscriptionPending(true);

    try {
      const state = await setIssueSubscription(workspaceSlug, projectKey, issue.issueKey, {
        subscribed: !isSubscribed
      });

      setIsSubscribed(state.subscribed);
    } catch (subscriptionError) {
      setError(subscriptionError instanceof Error ? subscriptionError.message : "구독 상태 변경에 실패했습니다.");
    } finally {
      setIsSubscriptionPending(false);
    }
  };

  const handleCreateSubIssue = async () => {
    if (subIssueTitle.trim().length === 0) {
      return;
    }

    try {
      const created = await createIssue(workspaceSlug, projectKey, {
        description: "",
        parentIssueKey: issue.issueKey,
        title: subIssueTitle.trim()
      });

      setSubIssueTitle("");
      onIssueUpdated({
        ...issue,
        subIssues: [...issue.subIssues, created]
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "서브이슈 생성에 실패했습니다.");
    }
  };

  const handleSaveBoardConfig = async () => {
    setIsSavingBoardConfig(true);

    try {
      const updated = await updateProjectBoardConfig(workspaceSlug, projectKey, {
        columns: draftBoardConfigColumns
      });

      setBoardConfigColumns(updated.columns);
      setIsStatusSettingsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "보드 설정 저장에 실패했습니다.");
    } finally {
      setIsSavingBoardConfig(false);
    }
  };

  const layoutClassName = mode === "drawer" ? "grid gap-8" : "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]";

  const timelineItems = useMemo(() => {
    const items: Array<
      | (IssueCommentDto & { kind: "comment" })
      | { createdAt: string; id: string; kind: "event"; actorUserId: string; summary: string }
    > = [
      ...comments.map((comment) => ({
        ...comment,
        kind: "comment" as const
      })),
      ...activityItems.map((event) => ({
        ...event,
        kind: "event" as const
      }))
    ];

    return items.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  }, [comments, activityItems]);

  const commentFilePreviews = useMemo(
    () =>
      commentFiles.map((file) => ({
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
      })),
    [commentFiles]
  );

  return (
    <div className={layoutClassName}>
      <div className="grid gap-2">
        <section className="grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex h-6 items-center rounded-md bg-secondary/50 px-2 font-mono text-[11px] font-medium text-foreground ring-1 ring-inset ring-border/30">
                {issue.issueKey}
              </span>
              <div className="flex items-center gap-1 rounded-md bg-secondary/35 px-1.5 py-0.5 ring-1 ring-inset ring-border/20">
                <span className="text-muted-foreground">{renderProjectBoardIcon(currentStatePresentation.iconKey, "size-3.5")}</span>
                <span className="text-[12px] font-medium text-foreground">{currentStatePresentation.label}</span>
              </div>
              <div className="flex items-center gap-1 rounded-md bg-secondary/35 px-1.5 py-0.5 ring-1 ring-inset ring-border/20">
                <span className="text-muted-foreground">{getPriorityIcon(issue.priority)}</span>
                <span className="text-[12px] font-medium text-foreground">{priorityLabel[issue.priority]}</span>
              </div>
              {issue.parent ? (
                <Link
                  href={getIssueHref(workspaceSlug, projectKey, issue.parent.issueKey)}
                  className="flex items-center gap-1 rounded-md bg-secondary/35 px-1.5 py-0.5 text-foreground ring-1 ring-inset ring-border/20 transition-colors hover:bg-secondary/50"
                >
                  <CornerDownRight className="size-3 text-muted-foreground" />
                  <span className="text-[12px] font-medium">{issue.parent.issueKey}</span>
                </Link>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                disabled={isSubscriptionPending}
                onClick={() => void handleSubscriptionToggle()}
                aria-label={isSubscribed ? "Unsubscribe" : "Subscribe"}
              >
                {isSubscribed ? <BellOff className="size-4" /> : <Bell className="size-4" />}
                <span className="sr-only">{isSubscribed ? "Unsubscribe" : "Subscribe"}</span>
              </Button>
              {isAutosaving ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : null}
            </div>
          </div>

          <Input
            value={draftTitle}
            onChange={(event) => handleDraftTitleChange(event.target.value)}
            onBlur={() => void flushContentSaveNow()}
            className="h-auto border-0 bg-transparent px-0 text-[20px] font-semibold leading-[1.35] tracking-tight shadow-none focus-visible:ring-0"
          />

          <div className="border-b border-border/50 pb-4">
            <MarkdownEditor
              value={draftDescription}
              onChange={handleDraftDescriptionChange}
              onBlur={() => void flushContentSaveNow()}
              workspaceMembers={workspaceMembers}
              getMentionHref={getWorkspaceMentionHref}
              placeholder="Add description..."
              editorClassName={cn(
                "min-h-[96px] px-0 py-0 text-[15px] leading-7",
                isDescriptionHighlighted && "rounded-xl bg-primary/5"
              )}
              className="border-none bg-transparent shadow-none"
            />

            {issue.attachments.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {issue.attachments.map((attachment) => {
                  const href = getIssueAttachmentHref(workspaceSlug, projectKey, issue.issueKey, attachment.id);
                  const isImage = attachment.contentType.startsWith("image/");

                  return isImage ? (
                    <div key={attachment.id} className="group relative">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-xl bg-secondary/20 ring-1 ring-inset ring-border/20"
                      >
                        <img src={href} alt={attachment.fileName} className="max-h-[32rem] w-full object-cover transition-transform group-hover:scale-[1.02]" />
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAttachment(attachment.id)}
                        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg bg-background/80 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-all hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                        title="Delete image"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <div key={attachment.id} className="group relative">
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-border/40 bg-secondary/15 px-4 py-3 text-sm transition-colors hover:bg-secondary/30"
                      >
                        <FileText className="size-5 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">{attachment.fileName}</div>
                          <div className="text-xs text-muted-foreground">
                            {attachment.contentType} · {(attachment.byteSize / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleDeleteAttachment(attachment.id)}
                        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg bg-background/80 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-all hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                        title="Delete file"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {issue.reactions.map((reaction) => (
                  <ReactionChip
                    key={reaction.emoji}
                    reaction={reaction}
                    active={reaction.userIds.includes(resolvedViewerUserId)}
                    onToggle={() => handleReactionToggle(reaction.emoji)}
                  />
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    <SmilePlus className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="p-0 border-none shadow-none bg-transparent overflow-visible">
                  <div className="z-50">
                    <Picker
                      data={data}
                      onEmojiSelect={(emoji: any) => {
                        handleReactionToggle(emoji.native);
                      }}
                      theme="auto"
                      previewPosition="none"
                      skinTonePosition="none"
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={descriptionFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const nextFiles = Array.from(event.target.files ?? []);
                  void handleUploadAttachment(nextFiles);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                onClick={() => descriptionFileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
              </button>
            </div>
          </div>

          <DisclosureSection
            storageKey={`${issue.id}-subissues`}
            title="Sub-issues"
            meta={issue.subIssues.length > 0 ? `${issue.subIssues.length} linked` : "Connect tasks together."}
          >
            <div className="grid gap-3">
              {issue.parent ? (
                <div className="grid gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Parent issue</div>
                  <IssueReferenceRow
                    boardConfigColumns={boardConfigColumns}
                    issue={issue.parent}
                    projectKey={projectKey}
                    workspaceSlug={workspaceSlug}
                  />
                </div>
              ) : null}

              {issue.subIssues.length > 0 && (
                <div className="grid gap-2">
                  {issue.subIssues.map((subIssue) => (
                    <IssueReferenceRow
                      boardConfigColumns={boardConfigColumns}
                      key={subIssue.id}
                      issue={subIssue}
                      projectKey={projectKey}
                      workspaceSlug={workspaceSlug}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Input
                  value={subIssueTitle}
                  onChange={(event) => setSubIssueTitle(event.target.value)}
                  placeholder="Add sub-issue"
                  className="h-9 border-border/40 bg-background/50 text-sm shadow-none"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreateSubIssue();
                    }
                  }}
                />
                <Button type="button" variant="secondary" size="sm" className="h-9" disabled={isPending || subIssueTitle.trim().length === 0} onClick={handleCreateSubIssue}>
                  Add
                </Button>
              </div>
            </div>
          </DisclosureSection>

          <div className="group/activity mt-4 border-t border-border/50 pt-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-foreground">Activity</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isSubscriptionPending}
                  onClick={() => void handleSubscriptionToggle()}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {isSubscribed ? "Unsubscribe" : "Subscribe"}
                </button>
                <Avatar className="size-6 border border-border/60 bg-secondary/60">
                  <AvatarFallback className="bg-transparent text-[10px] font-bold text-foreground">
                    {userDirectory[viewerUserId]?.initials ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="relative space-y-0 pb-2 pl-2">
              <div className="absolute bottom-6 left-[15px] top-2 w-px bg-border/20" />
              
              {timelineItems.map((item) => {
                if (item.kind === "comment") {
                  if (item.parentCommentId) return null;
                  
                  const replies = comments.filter(c => c.parentCommentId === item.id);
                  const isResolved = resolvedCommentIds.has(item.id);

                  return (
                    <div key={item.id} className="relative z-10 pb-6">
                      <CommentItem
                        comment={item}
                        replies={replies}
                        userDirectory={userDirectory}
                        workspaceMembers={workspaceMembers}
                        getWorkspaceMentionHref={getWorkspaceMentionHref}
                        viewerUserId={resolvedViewerUserId}
                        replyToCommentId={replyToCommentId}
                        setReplyToCommentId={setReplyToCommentId}
                        replyBody={replyBody}
                        setReplyBody={setReplyBody}
                        onReply={() => handleCreateComment(item.id)}
                        isSubmitting={isCommentSubmitting}
                        commentRefs={commentRefs}
                        highlightedCommentId={highlightedCommentId}
                        isResolved={isResolved}
                        onToggleResolve={() => handleToggleResolve(item.id)}
                        onReactionToggle={(emoji) => handleCommentReactionToggle(item.id, emoji)}
                      />
                    </div>
                  );
                }

                // System Event
                const getEventIcon = () => {
                  const s = item.summary;
                  if (s.includes("In Progress") || s.includes("In progress")) return <div className="text-blue-500/70">{renderProjectBoardIcon("loader_circle", "size-3.5")}</div>;
                  if (s.includes("Done")) return <div className="text-emerald-500/70">{renderProjectBoardIcon("check_circle_2", "size-3.5")}</div>;
                  if (s.includes("Todo")) return <div className="text-amber-500/70">{renderProjectBoardIcon("list_todo", "size-3.5")}</div>;
                  if (s.includes("Backlog")) return <div className="text-slate-400/70">{renderProjectBoardIcon("circle_dashed", "size-3.5")}</div>;
                  if (s.includes("canceled")) return <div className="text-muted-foreground/40">{renderProjectBoardIcon("ban", "size-3.5")}</div>;
                  
                  if (s.includes("set priority to Urgent")) return <div className="text-orange-500/70"><AlertTriangle className="size-3.5" /></div>;
                  if (s.includes("set priority to High")) return <div className="text-amber-500/70"><TripleChevronUp className="size-3.5" /></div>;
                  if (s.includes("set priority to Medium")) return <div className="text-emerald-500/70"><ChevronsUp className="size-3.5" /></div>;
                  if (s.includes("set priority to Low")) return <div className="text-sky-500/70"><ChevronUp className="size-3.5" /></div>;
                  if (s.includes("set priority to No priority")) return <div className="text-muted-foreground/20"><Minus className="size-3.5" /></div>;

                  if (s.includes("assigned to") || s.includes("changed reporter")) return <div className="text-muted-foreground/40"><UserRound className="size-3.5" /></div>;

                  return <div className="text-muted-foreground/30">{renderProjectBoardIcon("circle_dashed", "size-3.5")}</div>;
                };

                return (
                  <div key={item.id} className="relative flex items-center gap-3 pb-4">
                    <div className="relative z-10 flex size-7 items-center justify-center rounded-full bg-background text-muted-foreground ring-4 ring-background">
                      {getEventIcon()}
                    </div>
                    <div className="text-[12px] text-muted-foreground/60">
                      <span className="font-medium text-foreground/80">{getDirectoryUserLabel(userDirectory, item.actorUserId)}</span>
                      {" "}{item.summary}
                      {" · "}<span className="text-muted-foreground/40">{formatDateTime(item.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-2 rounded-xl border border-border/45 bg-background/35 px-4 pb-3 pt-3.5 ring-1 ring-inset ring-transparent transition-all focus-within:bg-background/60 focus-within:ring-primary/20">
              <input
                ref={commentFileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const nextFiles = Array.from(event.target.files ?? []);
                  if (nextFiles.length === 0) return;
                  setCommentFiles((current) => [...current, ...nextFiles]);
                  event.currentTarget.value = "";
                }}
              />
              {commentFiles.length > 0 ? (
                <div className="mb-4 grid gap-2">
                  {commentFilePreviews.map(({ file, previewUrl }, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {previewUrl ? <ImageIcon className="size-4 text-muted-foreground" /> : <FileText className="size-4 text-muted-foreground" />}
                        <span className="truncate text-xs font-medium">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCommentFiles((current) => current.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <MarkdownEditor
                value={commentBody}
                onChange={setCommentBody}
                workspaceMembers={workspaceMembers}
                getMentionHref={getWorkspaceMentionHref}
                placeholder="Leave a comment..."
                editorClassName="min-h-[60px] px-0 py-0 text-[14px]"
                className="border-0 bg-transparent shadow-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    handleCreateComment();
                  }
                }}
              />
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  className="text-muted-foreground/60 transition-colors hover:text-foreground"
                  onClick={() => commentFileInputRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={isCommentSubmitting || (commentBody.trim().length === 0 && commentFiles.length === 0)}
                  onClick={() => handleCreateComment()}
                  className="inline-flex size-6 items-center justify-center rounded-md bg-secondary/50 text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-30"
                >
                  {isCommentSubmitting ? <LoaderCircle className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          {error ? <div className="rounded-xl bg-destructive/8 px-3 py-2 text-sm text-destructive ring-1 ring-destructive/20">{error}</div> : null}
        </section>
      </div>

      <aside className="grid content-start gap-3">
        <PropertyDisclosure storageKey={`${issue.id}-overview`} title="Overview" defaultOpen>
          <div className="flex flex-col gap-1 py-1 text-sm">
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-foreground transition-colors hover:bg-secondary/60">
                    <span className="text-muted-foreground">{renderProjectBoardIcon(currentStatePresentation.iconKey, "size-4")}</span>
                    <span className="font-medium">{currentStatePresentation.label}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-60">
                  <DropdownSearchInput placeholder="Search status..." value={stateSearch} onChange={setStateSearch} />
                  {filteredStates.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => handleStateChange(option.value)}>
                      <span className="mr-2 text-muted-foreground">{renderProjectBoardIcon(option.iconKey, "size-4")}</span>
                      {option.label}
                      {issue.state === option.value ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                  {filteredStates.length === 0 ? <DropdownMenuItem disabled>No status found</DropdownMenuItem> : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={boardConfigColumns.length === 0}
                    onSelect={(event) => {
                      event.preventDefault();
                      setIsStatusSettingsOpen(true);
                    }}
                  >
                    Customize status icons
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-foreground transition-colors hover:bg-secondary/60">
                    <span className="text-muted-foreground">{getPriorityIcon(issue.priority)}</span>
                    <span className="font-medium">{priorityLabel[issue.priority]}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                  {priorityOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => handlePriorityChange(option.value)}>
                      <span className="mr-2 text-muted-foreground">{getPriorityIcon(option.value)}</span>
                      {option.label}
                      {issue.priority === option.value ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-foreground transition-colors hover:bg-secondary/60">
                    <div className="flex items-center gap-2 font-medium">
                      {selectedAssignee ? (
                        <>
                          <Avatar className="size-5 border border-border/60 bg-secondary/60">
                            <AvatarFallback className="bg-transparent text-[9px] font-bold text-foreground">
                              {userDirectory[issue.assigneeUserId ?? ""]?.initials ?? "U"}
                            </AvatarFallback>
                          </Avatar>
                          {selectedAssignee.user.name}
                        </>
                      ) : (
                        <>
                          <UserRound className="size-4 text-muted-foreground" />
                          <span className="text-muted-foreground/80">Unassigned</span>
                        </>
                      )}
                    </div>
                    <ChevronDown className="size-3.5 text-muted-foreground/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-60">
                  <DropdownSearchInput placeholder="Search assignee..." value={assigneeSearch} onChange={setAssigneeSearch} />
                  <DropdownMenuItem onSelect={() => handleAssigneeChange("unassigned")}>
                    <span className="mr-2 flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">-</span>
                    No assignee
                    {!issue.assigneeUserId ? <Check className="ml-auto size-4" /> : null}
                  </DropdownMenuItem>
                  {filteredMembers.map((member) => (
                    <DropdownMenuItem key={member.userId} onSelect={() => handleAssigneeChange(member.userId)}>
                      <span className="mr-2 flex size-5 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold">
                        {member.user.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="truncate">{member.user.name}</span>
                      {issue.assigneeUserId === member.userId ? <Check className="ml-auto size-4" /> : null}
                    </DropdownMenuItem>
                  ))}
                  {filteredMembers.length === 0 ? <DropdownMenuItem disabled>No user found</DropdownMenuItem> : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-foreground transition-colors hover:bg-secondary/60">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span className={cn("font-medium", !issue.dueDate && "text-muted-foreground/80")}>
                      {issue.dueDate ?? "No due date"}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64">
                  <div className="px-2 py-2">
                    <input
                      type="date"
                      value={issue.dueDate ?? ""}
                      onChange={(event) => handleDueDateChange(event.target.value)}
                      className="h-8 w-full rounded-md border border-border/80 bg-background px-2 text-xs outline-none"
                    />
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => handleDueDateChange(inDays(1))}>Tomorrow</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleDueDateChange(endOfWeek())}>End of this week</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleDueDateChange(inDays(7))}>In one week</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleDueDateChange("")}>No due date</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-foreground transition-colors hover:bg-secondary/60">
                    <Tag className="size-4 text-muted-foreground" />
                    <span className="flex flex-wrap items-center gap-1.5">
                      {issue.labels.length > 0 ? (
                        issue.labels.map((label) => (
                          <span
                            key={label.id}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-foreground ring-1 ring-inset ring-border/20"
                          >
                            <span className="size-1.5 rounded-full" style={{ backgroundColor: getLabelColor(label.color) }} />
                            {label.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground/80">No labels</span>
                      )}
                    </span>
                    <ChevronDown className="size-3.5 text-muted-foreground/40" />
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
                        checked={issue.labels.some((current) => current.id === label.id)}
                        onCheckedChange={(checked) => {
                          const nextLabelIds = checked
                            ? [...new Set([...issue.labels.map((current) => current.id), label.id])]
                            : issue.labels.map((current) => current.id).filter((id) => id !== label.id);
                          handleLabelChange(nextLabelIds);
                        }}
                      >
                        <span className={cn("mr-2 size-2 rounded-full", labelColorClasses[label.color] ?? "bg-slate-500")} />
                        {label.name}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </PropertyDisclosure>

        <PropertyDisclosure storageKey={`${issue.id}-context`} title="Context">
          <div className="grid gap-3 py-1 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Project</span>
              <span className="font-medium text-foreground">{projectKey}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Reporter</span>
              <span className="text-right font-medium text-foreground">{getDirectoryUserLabel(userDirectory, issue.reporterUserId)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Created</span>
              <span className="text-right text-muted-foreground">{formatDateTime(issue.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Updated</span>
              <span className="text-right text-muted-foreground">{formatDateTime(issue.updatedAt)}</span>
            </div>
          </div>
        </PropertyDisclosure>

        {mode === "drawer" ? (
          <Button asChild variant="secondary" className="mt-4 w-full justify-between px-4 text-xs font-medium">
            <Link href={getIssueHref(workspaceSlug, projectKey, issue.issueKey)}>
              Open full page
              <ArrowUpRight className="ml-2 size-3.5" />
            </Link>
          </Button>
        ) : null}
      </aside>

      <Dialog open={isStatusSettingsOpen} onOpenChange={setIsStatusSettingsOpen}>
        <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/45">
            <DialogTitle>Project Status Icons</DialogTitle>
            <DialogDescription>
              Choose icons for each project state to customize how issues are represented in lists and boards.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto bg-card/35">
            <ProjectBoardSettingsEditor
              columns={draftBoardConfigColumns}
              disabled={isSavingBoardConfig}
              onChange={setDraftBoardConfigColumns}
            />
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/45 bg-muted/20">
            <Button variant="outline" onClick={() => setIsStatusSettingsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveBoardConfig()}
              disabled={isSavingBoardConfig || draftBoardConfigColumns === boardConfigColumns || draftBoardConfigColumns.length === 0}
            >
              {isSavingBoardConfig ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short"
  }).format(new Date(value));

const imageEmbedPattern = /^!\[(.+)\]\((.+)\)$/;
const fileEmbedPattern = /^\[(.+)\]\((.+)\)$/;

const parseCommentEmbeds = (body: string) => {
  const embeds: Array<{ kind: "file" | "image"; name: string; url: string }> = [];
  const textLines: string[] = [];

  body.split("\n").forEach((line) => {
    const trimmed = line.trim();
    const imageMatch = imageEmbedPattern.exec(trimmed);
    const fileMatch = fileEmbedPattern.exec(trimmed);

    if (imageMatch) {
      embeds.push({
        kind: "image",
        name: imageMatch[1] ?? "Image",
        url: imageMatch[2] ?? ""
      });
    } else if (fileMatch) {
      embeds.push({
        kind: "file",
        name: fileMatch[1] ?? "File",
        url: fileMatch[2] ?? ""
      });
    } else {
      textLines.push(line);
    }
  });

  return {
    embeds,
    text: textLines.join("\n").trim()
  };
};

function PropertyDisclosure({
  children,
  defaultOpen = false,
  storageKey,
  title
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") {
      return defaultOpen;
    }
    const saved = localStorage.getItem(`wevlo-disclosure-${storageKey}`);
    return saved ? saved === "true" : defaultOpen;
  });

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(`wevlo-disclosure-${storageKey}`, String(next));
  };

  return (
    <div className="grid gap-2 border-b border-border/45 pb-3">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between py-1 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        {title}
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", !isOpen && "-rotate-90")} />
      </button>
      {isOpen ? <div>{children}</div> : null}
    </div>
  );
}

function DisclosureSection({
  action,
  children,
  defaultOpen = false,
  meta,
  storageKey,
  title
}: {
  action?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  meta?: string;
  storageKey: string;
  title: string;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") {
      return defaultOpen;
    }
    const saved = localStorage.getItem(`wevlo-disclosure-${storageKey}`);
    return saved ? saved === "true" : defaultOpen;
  });

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem(`wevlo-disclosure-${storageKey}`, String(next));
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggle}
          className="group flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform duration-200", !isOpen && "-rotate-90")} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {meta ? <span className="ml-2 text-xs text-muted-foreground/60">{meta}</span> : null}
        </button>
        {action ? <div>{action}</div> : null}
      </div>
      {isOpen ? <div className="pl-6">{children}</div> : null}
    </div>
  );
}

function IssueReferenceRow({
  boardConfigColumns,
  issue,
  projectKey,
  workspaceSlug
}: {
  boardConfigColumns: ProjectBoardColumnConfigDto[];
  issue: IssueReferenceDto;
  projectKey: string;
  workspaceSlug: string;
}) {
  const presentation = getProjectStatePresentation(issue.state, boardConfigColumns);

  return (
    <Link
      href={getIssueHref(workspaceSlug, projectKey, issue.issueKey)}
      className="group flex items-center justify-between rounded-lg border border-border/40 bg-secondary/10 px-3 py-2 transition-colors hover:bg-secondary/25"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-muted-foreground">{renderProjectBoardIcon(presentation.iconKey, "size-4")}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{issue.issueKey}</span>
        <span className="truncate text-sm font-medium text-foreground/90">{issue.title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{issue.priority}</span>
      </div>
    </Link>
  );
}

function CommentItem({
  comment,
  replies = [],
  userDirectory,
  workspaceMembers,
  getWorkspaceMentionHref,
  viewerUserId,
  replyToCommentId,
  setReplyToCommentId,
  replyBody,
  setReplyBody,
  onReply,
  isSubmitting,
  commentRefs,
  highlightedCommentId,
  isReply = false,
  isResolved = false,
  onToggleResolve,
  onReactionToggle
}: {
  comment: IssueCommentDto;
  replies?: IssueCommentDto[];
  userDirectory: UserDirectory;
  workspaceMembers: WorkspaceMemberDto[];
  getWorkspaceMentionHref: (input: { handle: string; userId: string }) => string | undefined;
  viewerUserId: string;
  replyToCommentId: string | null;
  setReplyToCommentId: (id: string | null) => void;
  replyBody: string;
  setReplyBody: (body: string) => void;
  onReply: () => void;
  isSubmitting: boolean;
  commentRefs: any;
  highlightedCommentId: string | null;
  isReply?: boolean;
  isResolved?: boolean;
  onToggleResolve?: () => void;
  onReactionToggle?: (emoji: string) => void;
}) {
  const parsed = parseCommentEmbeds(comment.body);
  const isReplying = replyToCommentId === comment.id;

  return (
    <div className="grid gap-2">
      <div
        id={`comment-${comment.id}`}
        ref={(node) => {
          commentRefs.current[comment.id] = node;
        }}
        className={cn(
          "group relative flex gap-3 rounded-2xl transition-all",
          !isReply && "bg-secondary/25 p-4 ring-1 ring-border/30 shadow-sm",
          isReply && "py-2 px-1 hover:bg-secondary/10",
          highlightedCommentId === comment.id && "ring-2 ring-primary/40 bg-primary/5",
          isResolved && !isReply && "opacity-60 grayscale-[0.2]"
        )}
      >
        <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-background ring-4 ring-background">
          <Avatar className="size-6 bg-secondary/80">
            <AvatarFallback className="bg-transparent text-[9px] font-bold text-foreground">
              {userDirectory[comment.authorUserId]?.initials ?? "U"}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-foreground/90">{getDirectoryUserLabel(userDirectory, comment.authorUserId)}</span>
              <span className="text-muted-foreground/60">{formatDateTime(comment.createdAt)}</span>
              {isResolved && !isReply && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500/80 ring-1 ring-inset ring-emerald-500/20">
                  <Check className="size-2.5" /> Resolved
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    >
                      <SmilePlus className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="p-0 border-none shadow-none bg-transparent overflow-visible">
                    <div className="z-50">
                      <Picker
                        data={data}
                        onEmojiSelect={(emoji: any) => {
                          onReactionToggle?.(emoji.native);
                        }}
                        theme="auto"
                        previewPosition="none"
                        skinTonePosition="none"
                      />
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="gap-2">
                      <Pencil className="size-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      onSelect={(event) => {
                        event.preventDefault();
                        onToggleResolve?.();
                      }}
                    >
                      {isResolved ? (
                        <><Plus className="size-3.5" /> Unresolve thread</>
                      ) : (
                        <><Check className="size-3.5" /> Resolve thread</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2">
                      <LinkIcon className="size-3.5" /> Copy link to comment
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                      <Trash2 className="size-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {!isReply && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyToCommentId(isReplying ? null : comment.id);
                    if (!isReplying) setReplyBody("");
                  }}
                  className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  {isReplying ? "Cancel" : "Reply"}
                </button>
              )}
            </div>
          </div>
          {(!isResolved || isReply || isReplying) && (
            <div className="mt-1.5 space-y-3">
              {parsed.text ? (
                <MarkdownViewer
                  value={parsed.text}
                  className="text-[14px] leading-relaxed text-muted-foreground/90"
                  workspaceMembers={workspaceMembers}
                  getMentionHref={getWorkspaceMentionHref}
                />
              ) : null}

              {comment.reactions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {comment.reactions.map((reaction) => (
                    <ReactionChip
                      key={reaction.emoji}
                      reaction={reaction}
                      active={reaction.userIds.includes(viewerUserId)}
                      onToggle={() => onReactionToggle?.(reaction.emoji)}
                    />
                  ))}
                </div>
              )}

              {parsed.embeds.length > 0 && (
                <div className="grid gap-2">
                  {parsed.embeds.map((embed, idx) =>
                    embed.kind === "image" ? (
                      <a
                        key={`${comment.id}-embed-${idx}`}
                        href={embed.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block max-w-lg overflow-hidden rounded-xl bg-background/60"
                      >
                        <img src={embed.url} alt={embed.name} className="max-h-[20rem] w-full object-cover" />
                      </a>
                    ) : (
                      <a
                        key={`${comment.id}-embed-${idx}`}
                        href={embed.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex max-w-md items-center gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-secondary/30"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{embed.name}</span>
                      </a>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && !isResolved && (
        <div className="ml-10 grid gap-3 border-l border-border/40 pl-6">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              userDirectory={userDirectory}
              workspaceMembers={workspaceMembers}
              getWorkspaceMentionHref={getWorkspaceMentionHref}
              viewerUserId={viewerUserId}
              replyToCommentId={replyToCommentId}
              setReplyToCommentId={setReplyToCommentId}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              onReply={onReply}
              isSubmitting={isSubmitting}
              commentRefs={commentRefs}
              highlightedCommentId={highlightedCommentId}
              onReactionToggle={(emoji) => onReactionToggle?.(emoji)}
            />
          ))}
        </div>
      )}

      {isReplying && (
        <div className="ml-10 mt-1 rounded-xl border border-border/45 bg-background/35 p-3 ring-1 ring-inset ring-transparent transition-all focus-within:bg-background/60 focus-within:ring-primary/20">
          <MarkdownEditor
            value={replyBody}
            onChange={setReplyBody}
            workspaceMembers={workspaceMembers}
            getMentionHref={getWorkspaceMentionHref}
            placeholder="Write a reply..."
            editorClassName="min-h-[40px] px-0 py-0 text-[13px]"
            className="border-0 bg-transparent shadow-none"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onReply();
              }
            }}
          />
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              disabled={isSubmitting || replyBody.trim().length === 0}
              onClick={onReply}
              className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors disabled:opacity-30"
            >
              {isSubmitting ? <LoaderCircle className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReactionChip({
  reaction,
  active,
  onToggle
}: {
  reaction: { emoji: string; count: number; userIds: string[] };
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
      )}
    >
      <span>{reaction.emoji}</span>
      <span className="tabular-nums">{reaction.count}</span>
    </button>
  );
}
