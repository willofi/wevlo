"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Image from "@tiptap/extension-image";
import { memo, useEffect, useMemo } from "react";
import type { WorkspaceMemberDto } from "@wevlo/contracts";
import { cn } from "../../lib/utils";
import {
  createMarkdownMentionExtension,
  createMentionLookup,
  hydrateMarkdownMentions,
  normalizeStoredMentionMarkdown,
  serializeMarkdownWithMentions,
  type MarkdownMentionHrefResolver
} from "./markdown-mention";

export type MarkdownViewerProps = {
  value: string;
  className?: string;
  getMentionHref?: MarkdownMentionHrefResolver;
  workspaceMembers?: WorkspaceMemberDto[];
};

export const MarkdownViewer = memo(function MarkdownViewer({
  value,
  className,
  getMentionHref,
  workspaceMembers = []
}: MarkdownViewerProps) {
  const normalizedValue = useMemo(
    () => normalizeStoredMentionMarkdown(value, workspaceMembers, getMentionHref),
    [getMentionHref, value, workspaceMembers]
  );
  const resolveMention = useMemo(() => {
    const mentionsByHandle = createMentionLookup(workspaceMembers);

    return (handle: string) => mentionsByHandle.get(handle.toLowerCase());
  }, [workspaceMembers]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({
        HTMLAttributes: {
          class: "rounded-xl max-h-[32rem] object-cover border border-border/20 shadow-sm"
        }
      }),
      Markdown.configure({
        html: false,
        linkify: true,
        breaks: true
      }),
      createMarkdownMentionExtension({ getMentionHref, resolveMention })
    ],
    content: normalizedValue,
    editable: false,
    editorProps: {
      attributes: {
        class: cn("markdown-surface prose prose-sm max-w-none focus:outline-none", className)
      }
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (normalizedValue !== serializeMarkdownWithMentions(editor)) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }

    hydrateMarkdownMentions(editor as any, workspaceMembers);
  }, [editor, normalizedValue, workspaceMembers]);

  return (
    <>
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
      `}</style>
    </>
  );
});
