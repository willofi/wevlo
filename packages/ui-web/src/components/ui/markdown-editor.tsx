"use client";

import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Image from "@tiptap/extension-image";
import { useEffect, useMemo, useRef } from "react";
import tippy from "tippy.js";
import type { Instance } from "tippy.js";
import { cn } from "../../lib/utils";
import {
  createMarkdownMentionExtension,
  createMentionLookup,
  hydrateMarkdownMentions,
  normalizeStoredMentionMarkdown,
  serializeMarkdownWithMentions,
  type MarkdownMentionHrefResolver
} from "./markdown-mention";
import { MentionList } from "./mention-list";
import type { WorkspaceMemberDto } from "@wevlo/contracts";

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  workspaceMembers?: WorkspaceMemberDto[];
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  autoFocus?: boolean;
  getMentionHref?: MarkdownMentionHrefResolver;
  onKeyDown?: (event: any) => void;
};

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  workspaceMembers = [],
  placeholder,
  className,
  editorClassName,
  autoFocus,
  getMentionHref,
  onKeyDown
}: MarkdownEditorProps) {
  const mentionCandidates = useMemo(
    () =>
      workspaceMembers.map((member) => ({
        member,
        searchText: `${member.user.name} ${member.user.handle}`.toLowerCase()
      })),
    [workspaceMembers]
  );
  const normalizedValue = useMemo(
    () => normalizeStoredMentionMarkdown(value, workspaceMembers, getMentionHref),
    [getMentionHref, value, workspaceMembers]
  );
  const lastEmittedMarkdownRef = useRef(normalizedValue);
  const suggestion = useMemo(() => ({
    command: ({ editor, props, range }: {
      editor: { chain: () => any };
      props: { id?: string | null; label?: string | null; name?: string | null };
      range: { from: number; to: number };
    }) => {
      const handle = props.label || props.id || "";
      if (!handle) {
        return;
      }

      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: "mention",
            attrs: {
              id: props.id,
              label: handle,
              mentionSuggestionChar: "@"
            }
          },
          {
            type: "text",
            text: " "
          }
        ])
        .run();
    },
    items: ({ query }: { query: string }) => {
      const needle = query.toLowerCase();

      return mentionCandidates
        .filter((candidate) => candidate.searchText.includes(needle))
        .slice(0, 8)
        .map((candidate) => candidate.member);
    },

    render: () => {
      let component: ReactRenderer<any>;
      let popup: Instance[] | undefined;

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start"
          });
        },

        onUpdate(props: any) {
          component.updateProps(props);

          if (!props.clientRect || !popup || !popup[0]) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect
          });
        },

        onKeyDown(props: any) {
          if (props.event.key === "Escape") {
            if (popup && popup[0]) {
              popup[0].hide();
            }
            return true;
          }

          return (component.ref as any)?.onKeyDown(props);
        },

        onExit() {
          if (popup && popup[0]) {
            popup[0].destroy();
          }
          component.destroy();
        }
      };
    }
  }), [mentionCandidates]);
  const resolveMention = useMemo(() => {
    const mentionsByHandle = createMentionLookup(workspaceMembers);

    return (handle: string) => mentionsByHandle.get(handle.toLowerCase());
  }, [workspaceMembers]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-xl max-h-[32rem] object-cover border border-border/20 shadow-sm"
        }
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        tightListClass: "tight",
        bulletListMarker: "-",
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true
      }),
      createMarkdownMentionExtension({
        getMentionHref,
        resolveMention,
        suggestion
      })
    ],
    onUpdate: ({ editor }) => {
      const markdown = serializeMarkdownWithMentions(editor);

      if (markdown === lastEmittedMarkdownRef.current) {
        return;
      }

      lastEmittedMarkdownRef.current = markdown;
      onChange(markdown);
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          "markdown-surface prose prose-sm max-w-none focus:outline-none min-h-[60px]",
          editorClassName
        ),
        spellcheck: "false",
        "data-placeholder": placeholder ?? ""
      },
      handleKeyDown: (view, event) => {
        if (onKeyDown) {
          onKeyDown(event);
        }
        return false;
      }
    },
    autofocus: autoFocus || false
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    // Only update internal state if we're not actively typing
    if (!editor.isFocused && normalizedValue !== serializeMarkdownWithMentions(editor)) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
      lastEmittedMarkdownRef.current = normalizedValue;
      hydrateMarkdownMentions(editor as any, workspaceMembers);
    }
  }, [editor, normalizedValue, workspaceMembers]);

  return (
    <div className={cn("relative w-full", className)}>
      <EditorContent editor={editor} />
      <style>{`
        .mention {
          background-color: rgba(147, 197, 253, 0.15);
          border-radius: 0.3rem;
          padding: 0.1rem 0.3rem;
          color: #60a5fa;
          font-weight: 500;
          text-decoration: none;
        }
        .prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
