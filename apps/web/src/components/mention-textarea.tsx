"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type FocusEvent, type KeyboardEvent, type TextareaHTMLAttributes } from "react";

import type { WorkspaceMemberDto } from "@wevlo/contracts";
import { cn } from "@wevlo/ui-web";

type MentionTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  onValueChange: (value: string) => void;
  value: string;
  workspaceMembers: WorkspaceMemberDto[];
};

type ActiveMention = {
  end: number;
  query: string;
  start: number;
};

const mentionPattern = /(^|[^a-z0-9_])@([a-z0-9_]*)$/i;

const getActiveMention = (value: string, caret: number | null): ActiveMention | null => {
  if (caret === null) {
    return null;
  }

  const prefix = value.slice(0, caret);
  const match = prefix.match(mentionPattern);

  if (!match || match.index === undefined) {
    return null;
  }

  const boundary = match[1] ?? "";
  const query = (match[2] ?? "").toLowerCase();
  const start = match.index + boundary.length;

  return {
    end: caret,
    query,
    start
  };
};

const getFilteredMembers = (workspaceMembers: WorkspaceMemberDto[], query: string) =>
  workspaceMembers
    .filter((member) => {
      if (query.length === 0) {
        return true;
      }

      return (
        member.user.handle.toLowerCase().includes(query) ||
        member.user.name.toLowerCase().includes(query)
      );
    })
    .sort((left, right) => left.user.name.localeCompare(right.user.name))
    .slice(0, 8);

export const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(function MentionTextarea(
  { className, onBlur, onKeyDown, onValueChange, value, workspaceMembers, ...props },
  forwardedRef
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);

  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

  const filteredMembers = activeMention ? getFilteredMembers(workspaceMembers, activeMention.query) : [];
  const isOpen = Boolean(activeMention) && filteredMembers.length > 0;

  const updateMentionState = (nextValue: string, caret: number | null) => {
    const nextMention = getActiveMention(nextValue, caret);
    setActiveMention(nextMention);
    setActiveIndex(0);
  };

  const insertMention = (handle: string) => {
    if (!activeMention || !textareaRef.current) {
      return;
    }

    const before = value.slice(0, activeMention.start);
    const after = value.slice(activeMention.end);
    const nextValue = `${before}@${handle} ${after}`;
    const nextCaret = before.length + handle.length + 2;

    onValueChange(nextValue);
    setActiveMention(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    window.setTimeout(() => {
      setActiveMention(null);
    }, 120);

    onBlur?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (current + 1) % filteredMembers.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (current - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const selected = filteredMembers[activeIndex];

        if (selected) {
          insertMention(selected.user.handle);
        }

        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setActiveMention(null);
        return;
      }
    }

    onKeyDown?.(event);
  };

  return (
    <div className="relative">
      <textarea
        {...props}
        ref={textareaRef}
        value={value}
        onBlur={handleBlur}
        onChange={(event) => {
          onValueChange(event.target.value);
          updateMentionState(event.target.value, event.target.selectionStart);
        }}
        onClick={(event) => updateMentionState(event.currentTarget.value, event.currentTarget.selectionStart)}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => updateMentionState(event.currentTarget.value, event.currentTarget.selectionStart)}
        className={cn(
          "flex min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-none transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      />
      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-sm overflow-hidden rounded-lg border border-border/70 bg-popover shadow-xl shadow-black/10">
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredMembers.map((member, index) => (
              <button
                key={member.userId}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(member.user.handle);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors",
                  index === activeIndex ? "bg-secondary" : "hover:bg-secondary/70"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{member.user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{member.user.handle}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
});
