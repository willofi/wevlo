"use client";

import Mention from "@tiptap/extension-mention";
import type { WorkspaceMemberDto } from "@wevlo/contracts";

export type MarkdownMentionHrefInput = {
  handle: string;
  userId: string;
};

export type MarkdownMentionHrefResolver = (input: MarkdownMentionHrefInput) => string | undefined;

export type MarkdownMentionResolveResult = {
  label?: string;
  userId?: string;
};

export type MarkdownMentionResolver = (handle: string) => MarkdownMentionResolveResult | undefined;

type CreateMarkdownMentionExtensionOptions = {
  getMentionHref?: MarkdownMentionHrefResolver | undefined;
  resolveMention?: MarkdownMentionResolver | undefined;
  suggestion?: Record<string, unknown> | undefined;
};

type MentionNodeLike = {
  attrs: Record<string, unknown>;
};

type MarkdownEditorLike = {
  state: {
    doc: {
      descendants: (
        callback: (
          node: MentionNodeLike & {
            isText?: boolean;
            marks?: ReadonlyArray<{ type?: { name?: string } }>;
            text?: string;
            type?: { name?: string };
          },
          pos: number,
          parent?: { type?: { name?: string } }
        ) => void | boolean
      ) => void;
    };
    schema: {
      nodes: {
        mention?: {
          create: (attrs: Record<string, unknown>) => unknown;
        };
      };
      text: (text: string) => unknown;
    };
    tr: {
      docChanged: boolean;
      replaceWith: (from: number, to: number, node: unknown) => MarkdownEditorLike["state"]["tr"];
      setMeta: (key: string, value: unknown) => MarkdownEditorLike["state"]["tr"];
    };
  };
  storage: Record<string, any>;
  view: {
    dispatch: (transaction: MarkdownEditorLike["state"]["tr"]) => void;
  };
};

const normalizeMentionValue = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/^@/, "");
};

const mentionPattern = /(^|[^a-z0-9_])@([a-z0-9_]{3,32})/gi;
const mentionMarkdownLinkPattern = /\[([^\]]*?@([a-z0-9_]{3,32})[^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gi;

const getMentionHandle = (node: MentionNodeLike) =>
  normalizeMentionValue(node.attrs.label) || normalizeMentionValue(node.attrs.id);

const getMentionUserId = (node: MentionNodeLike) =>
  normalizeMentionValue(node.attrs.id) || getMentionHandle(node);

export const getMentionMarkdownText = (node: MentionNodeLike) =>
  `@${getMentionHandle(node) || getMentionUserId(node)}`;

export const createMentionLookup = (workspaceMembers: WorkspaceMemberDto[]) =>
  new Map(
    workspaceMembers.map((member) => [
      member.user.handle.toLowerCase(),
      {
        handle: member.user.handle,
        label: `${member.user.name} @${member.user.handle}`,
        userId: member.userId
      }
    ])
  );

export const normalizeStoredMentionMarkdown = (
  markdown: string,
  workspaceMembers: WorkspaceMemberDto[],
  getMentionHref?: MarkdownMentionHrefResolver
) => {
  if (!markdown.includes("@") || workspaceMembers.length === 0) {
    return markdown;
  }

  const mentionsByHandle = createMentionLookup(workspaceMembers);

  return markdown.replace(mentionMarkdownLinkPattern, (match, _text, rawHandle, href) => {
    const mention = mentionsByHandle.get(String(rawHandle).toLowerCase());

    if (!mention) {
      return match;
    }

    const expectedHref = getMentionHref?.({ handle: mention.handle, userId: mention.userId });
    const pointsToMember =
      Boolean(expectedHref && href === expectedHref) ||
      String(href).endsWith(`/members/${encodeURIComponent(mention.userId)}`) ||
      String(href).endsWith(`/members/${mention.userId}`);

    return pointsToMember ? `@${mention.handle}` : match;
  });
};

/**
 * Serializes the editor content to Markdown.
 * Note: We rely on the Mention extension's storage.markdown.serialize to produce @handle.
 * If tiptap-markdown somehow produces [mention], this function fixes it.
 */
export const serializeMarkdownWithMentions = (editor: {
  state: {
    doc: {
      descendants: (callback: (node: MentionNodeLike & { type?: { name?: string } }) => void) => void;
    };
  };
  storage: Record<string, any>;
}) => {
  const markdown = editor.storage.markdown.getMarkdown() as string;

  // We find all mentions in the document order
  const mentions: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type?.name === "mention") {
      mentions.push(getMentionMarkdownText(node));
    }
  });

  if (mentions.length === 0) {
    return markdown;
  }

  // If tiptap-markdown produced [mention] placeholders, we replace them in order
  if (markdown.includes("[mention]")) {
    let mentionIndex = 0;
    return markdown.replace(/\[mention\]/g, (match) => {
      const result = mentions[mentionIndex] ?? match;
      mentionIndex++;
      return result;
    });
  }

  return markdown;
};

export const hydrateMarkdownMentions = (
  editor: MarkdownEditorLike,
  workspaceMembers: WorkspaceMemberDto[]
) => {
  const mentionNode = editor.state.schema.nodes.mention;

  if (!mentionNode || workspaceMembers.length === 0) {
    return false;
  }

  const mentionsByHandle = createMentionLookup(workspaceMembers);
  const replacements: Array<{
    attrs: Record<string, unknown>;
    from: number;
    to: number;
  }> = [];

  editor.state.doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text || parent?.type?.name === "codeBlock") {
      return;
    }

    if (node.marks?.some((mark) => mark.type?.name === "code" || mark.type?.name === "link")) {
      return;
    }

    mentionPattern.lastIndex = 0;

    for (const match of node.text.matchAll(mentionPattern)) {
      const prefix = match[1] ?? "";
      const rawHandle = match[2] ?? "";
      const mention = mentionsByHandle.get(rawHandle.toLowerCase());
      const index = match.index ?? 0;

      if (!mention) {
        continue;
      }

      const from = pos + index + prefix.length;
      const to = from + mention.handle.length + 1;

      replacements.push({
        attrs: {
          id: mention.userId,
          label: mention.handle,
          mentionSuggestionChar: "@"
        },
        from,
        to
      });
    }
  });

  if (replacements.length === 0) {
    return false;
  }

  let transaction = editor.state.tr;

  for (const replacement of replacements.sort((left, right) => right.from - left.from)) {
    transaction = transaction.replaceWith(
      replacement.from,
      replacement.to,
      mentionNode.create(replacement.attrs)
    );
  }

  if (!transaction.docChanged) {
    return false;
  }

  editor.view.dispatch(transaction.setMeta("addToHistory", false));
  return true;
};

export const createMarkdownMentionExtension = ({
  getMentionHref,
  resolveMention,
  suggestion
}: CreateMarkdownMentionExtensionOptions = {}) =>
  Mention.extend({
    parseHTML() {
      return [
        {
          tag: "span[data-type=\"mention\"]"
        },
        {
          tag: "a[data-type=\"mention\"]"
        }
      ];
    },
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-id"),
          renderHTML: (attributes) => {
            if (!attributes.id) {
              return {};
            }

            return {
              "data-id": attributes.id
            };
          }
        },
        label: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-label") || element.textContent?.replace(/^@/, "") || null,
          renderHTML: (attributes) => {
            if (!attributes.label) {
              return {};
            }

            return {
              "data-label": attributes.label,
              "data-type": "mention"
            };
          }
        },
        mentionSuggestionChar: {
          default: "@",
          parseHTML: (element) => element.getAttribute("data-mention-suggestion-char") ?? "@",
          renderHTML: (attributes) => ({
            "data-mention-suggestion-char": attributes.mentionSuggestionChar ?? "@"
          })
        }
      };
    },
    addStorage() {
      return {
        markdown: {
          serialize(state: { write: (text: string) => void }, node: MentionNodeLike) {
            state.write(getMentionMarkdownText(node));
          },
          parse: {
            setup(_markdownit: any) {
              // Custom setup if needed
            }
          }
        }
      };
    }
  }).configure({
    HTMLAttributes: {
      class: "mention",
      "data-type": "mention"
    },
    ...(suggestion ? { suggestion } : {}),
    renderText({ node }) {
      return getMentionMarkdownText(node);
    },
    renderHTML({ node, options }) {
      const handle = getMentionHandle(node);
      const userId = getMentionUserId(node);
      const resolved = handle ? resolveMention?.(handle.toLowerCase()) : undefined;
      const resolvedUserId = resolved?.userId ?? userId;
      const text = resolved?.label ?? getMentionMarkdownText(node);
      const href = handle && resolvedUserId ? getMentionHref?.({ handle, userId: resolvedUserId }) : undefined;
      const attributes = {
        ...options.HTMLAttributes,
        "data-id": resolvedUserId,
        "data-label": handle,
        "data-type": "mention"
      };

      if (href) {
        return [
          "a",
          {
            ...attributes,
            href
          },
          text
        ];
      }

      return [
        "span",
        attributes,
        text
      ];
    }
  });
