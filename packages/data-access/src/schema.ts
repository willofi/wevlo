import type {
  AuthProvider,
  IntegrationAuthType,
  IntegrationInstallationDto,
  IntegrationInstallationStatus,
  IntegrationProjectLinkDto,
  IntegrationProvider,
  IssuePriority,
  IssueSourceLinkDto,
  IssueState,
  IssueTriageStatus,
  ProjectBoardAccent,
  ProjectRole,
  WorkspaceInvitationDto,
  WorkspaceRole
} from "@wevlo/contracts";

export type WorkspaceTable = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type UserTable = {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type UserIdentityTable = {
  id: string;
  user_id: string;
  provider: AuthProvider;
  provider_user_id: string;
  email: string | null;
  created_at: string;
};

export type WorkspaceMembershipTable = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
};

export type ProjectTable = {
  id: string;
  workspace_id: string;
  name: string;
  project_key: string;
  visibility: "private" | "workspace";
  created_at: string;
  updated_at: string;
};

export type ProjectMembershipTable = {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
};

export type ProjectBoardColumnTable = {
  project_id: string;
  state: IssueState;
  label: string;
  column_order: number;
  accent: ProjectBoardAccent;
  created_at: string;
  updated_at: string;
};

export type WorkspaceInvitationStatus = WorkspaceInvitationDto["status"];

export type WorkspaceInvitationTable = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  invitee_user_id: string | null;
  invitee_email: string | null;
  role: WorkspaceInvitationDto["role"];
  status: WorkspaceInvitationStatus;
  invited_by_user_id: string;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  expires_at: string;
  accept_token: string | null;
  created_at: string;
  updated_at: string;
};

export type IssueTable = {
  id: string;
  project_id: string;
  issue_number: number;
  issue_key: string;
  title: string;
  description: string;
  state: IssueState;
  priority: IssuePriority;
  triage_status: IssueTriageStatus;
  reporter_user_id: string;
  assignee_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IssueCommentTable = {
  id: string;
  issue_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};

export type IssueSourceLinkTable = {
  id: string;
  issue_id: string;
  provider: IssueSourceLinkDto["provider"];
  external_id: string;
  source_of_truth: IssueSourceLinkDto["sourceOfTruth"];
  installation_id: string | null;
  external_project_id: string | null;
  external_key: string | null;
  external_url: string | null;
  last_synced_at: string | null;
  created_at: string;
};

export type IntegrationInstallationTable = {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  external_account_id: string;
  external_account_slug: string | null;
  auth_type: IntegrationAuthType;
  status: IntegrationInstallationStatus;
  webhook_secret: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type IntegrationProjectLinkTable = {
  id: string;
  installation_id: string;
  project_id: string;
  provider: IntegrationProjectLinkDto["provider"];
  external_project_id: string;
  external_project_path: string;
  source_of_truth: IntegrationProjectLinkDto["sourceOfTruth"];
  created_at: string;
  updated_at: string;
  last_imported_at: string | null;
  last_webhook_received_at: string | null;
};

export type WebhookDeliveryTable = {
  id: string;
  provider: IntegrationProvider;
  provider_delivery_id: string;
  installation_id: string | null;
  project_link_id: string | null;
  event_type: string;
  payload: string;
  status: "pending" | "processed" | "failed";
  error_message: string | null;
  received_at: string;
  processed_at: string | null;
};

export type SyncCursorTable = {
  id: string;
  project_link_id: string;
  cursor: string;
  updated_at: string;
};

export type AuditEventTable = {
  id: string;
  actor_id: string;
  action: string;
  resource_id: string;
  workspace_id: string | null;
  project_id: string | null;
  issue_id: string | null;
  payload: string | null;
  occurred_at: string;
};

export type SchemaMigrationTable = {
  name: string;
  applied_at: string;
};

export type DatabaseSchema = {
  audit_events: AuditEventTable;
  integration_installations: IntegrationInstallationTable;
  integration_project_links: IntegrationProjectLinkTable;
  issue_comments: IssueCommentTable;
  issue_source_links: IssueSourceLinkTable;
  issues: IssueTable;
  project_board_columns: ProjectBoardColumnTable;
  project_memberships: ProjectMembershipTable;
  projects: ProjectTable;
  schema_migrations: SchemaMigrationTable;
  sync_cursors: SyncCursorTable;
  user_identities: UserIdentityTable;
  users: UserTable;
  webhook_deliveries: WebhookDeliveryTable;
  workspace_invitations: WorkspaceInvitationTable;
  workspace_memberships: WorkspaceMembershipTable;
  workspaces: WorkspaceTable;
};
