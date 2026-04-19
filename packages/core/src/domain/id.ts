import { randomUUID } from "node:crypto";

export type EntityId = `${string}_${string}`;

export const createEntityId = (prefix: string): EntityId => {
  return `${prefix}_${randomUUID()}`;
};

type Brand<TValue, TBrand extends string> = TValue & { readonly __brand: TBrand };

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type WorkspaceSlug = Brand<string, "WorkspaceSlug">;
export type ProjectId = Brand<string, "ProjectId">;
export type ProjectKey = Brand<string, "ProjectKey">;
export type IssueId = Brand<string, "IssueId">;
export type UserId = Brand<string, "UserId">;
export type UserIdentityId = Brand<string, "UserIdentityId">;
export type WorkspaceInvitationId = Brand<string, "WorkspaceInvitationId">;
export type InvitationToken = Brand<string, "InvitationToken">;
export type AuditEventId = Brand<string, "AuditEventId">;

const trimAsciiBoundary = (value: string, separator: string): string => {
  const pattern = new RegExp(`^${separator}+|${separator}+$`, "g");
  return value.replace(pattern, "");
};

const normalizeAsciiSegments = (value: string, separator: "-" | ""): string => {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const collapsed = separator.length > 0
    ? ascii.replace(/[^a-z0-9]+/g, separator).replace(/-+/g, separator)
    : ascii.replace(/[^a-z0-9]+/g, "");

  return separator.length > 0 ? trimAsciiBoundary(collapsed, separator) : collapsed;
};

const normalizeProjectToken = (value: string): string => {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
};

export const createWorkspaceId = (): WorkspaceId => createEntityId("workspace") as WorkspaceId;
export const createProjectId = (): ProjectId => createEntityId("project") as ProjectId;
export const createIssueId = (): IssueId => createEntityId("issue") as IssueId;
export const createUserId = (): UserId => createEntityId("user") as UserId;
export const createUserIdentityId = (): UserIdentityId => createEntityId("user_identity") as UserIdentityId;
export const createWorkspaceInvitationId = (): WorkspaceInvitationId =>
  createEntityId("workspace_invitation") as WorkspaceInvitationId;
export const createInvitationToken = (): InvitationToken => createEntityId("invite_token") as InvitationToken;
export const createAuditEventId = (): AuditEventId => createEntityId("audit_event") as AuditEventId;

export const normalizeWorkspaceSlug = (value: string): WorkspaceSlug => {
  const normalized = normalizeAsciiSegments(value.trim(), "-");
  return (normalized.length > 0 ? normalized : "workspace") as WorkspaceSlug;
};

const deriveProjectKeyBase = (value: string): string => {
  const segments = value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .map((segment) => normalizeProjectToken(segment))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return "PRJ";
  }

  if (segments.length === 1) {
    const [singleSegment] = segments;
    return singleSegment ? singleSegment.slice(0, 4) || "PRJ" : "PRJ";
  }

  const initials = segments.map((segment) => segment[0]).join("").slice(0, 4);
  return initials.length >= 2 ? initials : segments.join("").slice(0, 4) || "PRJ";
};

export const normalizeProjectKey = (value: string): ProjectKey => {
  const normalized = normalizeProjectToken(value.trim());
  return (normalized.length > 0 ? normalized : "PRJ") as ProjectKey;
};

export const buildWorkspaceSlugCandidates = (seed: string, maxAttempts = 8): WorkspaceSlug[] => {
  const base = normalizeWorkspaceSlug(seed);

  return Array.from({ length: Math.max(1, maxAttempts) }, (_, index) =>
    (index === 0 ? base : `${base}-${index + 1}`) as WorkspaceSlug
  );
};

export const buildProjectKeyCandidates = (seed: string, maxAttempts = 8): ProjectKey[] => {
  const base = deriveProjectKeyBase(seed) as ProjectKey;

  return Array.from({ length: Math.max(1, maxAttempts) }, (_, index) =>
    (index === 0 ? base : `${base}${index + 1}`) as ProjectKey
  );
};
