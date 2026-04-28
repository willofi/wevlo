import type {
  AuthProvider,
  IntegrationAuthType,
  IntegrationInstallationStatus,
  NotificationCategory,
  NotificationEventType,
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
  avatar_content_type: string | null;
  avatar_storage_key: string | null;
  avatar_url: string | null;
  id: string;
  name: string;
  handle: string;
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
  icon_key: string;
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
  parent_issue_id: string | null;
  issue_number: number;
  issue_key: string;
  title: string;
  description: string;
  state: IssueState;
  priority: IssuePriority;
  triage_status: IssueTriageStatus;
  reporter_user_id: string;
  assignee_user_id: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectIssueLabelTable = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type IssueLabelAssignmentTable = {
  issue_id: string;
  label_id: string;
  created_at: string;
};

export type IssueAttachmentTable = {
  id: string;
  issue_id: string;
  uploaded_by_user_id: string;
  storage_key: string;
  file_name: string;
  content_type: string;
  byte_size: number;
  checksum: string;
  created_at: string;
  deleted_at: string | null;
};

export type IssueReactionTable = {
  issue_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type IssueCommentReactionTable = {
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type IssueCommentTable = {
  id: string;
  issue_id: string;
  author_user_id: string;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
};

export type IssueCommentMentionTable = {
  comment_id: string;
  mentioned_user_id: string;
  mentioned_handle: string;
  start_offset: number;
  end_offset: number;
};

export type IssueMentionTable = {
  issue_id: string;
  source_type: "comment" | "description";
  comment_id: string | null;
  mentioned_user_id: string;
  mentioned_handle: string;
  start_offset: number;
  end_offset: number;
};

export type IssueSubscriptionTable = {
  issue_id: string;
  user_id: string;
  is_active: boolean;
  manually_unsubscribed: boolean;
  created_at: string;
  updated_at: string;
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

export type NotificationPreferenceTable = {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  updated_at: string;
};

export type NotificationCategoryPreferenceTable = {
  user_id: string;
  category: NotificationCategory;
  in_app_enabled: boolean;
  email_enabled: boolean;
  updated_at: string;
};

export type NotificationTable = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  category: NotificationCategory;
  event_type: NotificationEventType;
  workspace_id: string | null;
  project_id: string | null;
  issue_id: string | null;
  invitation_id: string | null;
  title: string;
  body: string;
  href: string;
  payload_json: string;
  dedupe_key: string;
  created_at: string;
  seen_at: string | null;
  read_at: string | null;
  archived_at: string | null;
};

export type NotificationOutboxTable = {
  id: string;
  event_type: NotificationEventType;
  aggregate_type: string;
  aggregate_id: string;
  workspace_id: string | null;
  project_id: string | null;
  issue_id: string | null;
  invitation_id: string | null;
  actor_user_id: string | null;
  payload_json: string;
  available_at: string;
  status: "pending" | "processing" | "processed" | "failed";
  attempt_count: number;
  last_error: string | null;
  locked_at: string | null;
  locked_by: string | null;
  processed_at: string | null;
  created_at: string;
};

export type NotificationDeliveryTable = {
  id: string;
  notification_id: string | null;
  recipient_user_id: string;
  channel: "email";
  status: "pending" | "sent" | "failed";
  scheduled_for: string;
  sent_at: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type SchemaMigrationTable = {
  name: string;
  applied_at: string;
};

export type VerificationTokenTable = {
  identifier: string;
  token: string;
  expires: string;
};

export type DatabaseSchema = {
  audit_events: AuditEventTable;
  integration_installations: IntegrationInstallationTable;
  integration_project_links: IntegrationProjectLinkTable;
  issue_comment_mentions: IssueCommentMentionTable;
  issue_comment_reactions: IssueCommentReactionTable;
  issue_comments: IssueCommentTable;
  issue_mentions: IssueMentionTable;
  issue_attachments: IssueAttachmentTable;
  issue_reactions: IssueReactionTable;
  issue_label_assignments: IssueLabelAssignmentTable;
  issue_source_links: IssueSourceLinkTable;
  issue_subscriptions: IssueSubscriptionTable;
  issues: IssueTable;
  notification_category_preferences: NotificationCategoryPreferenceTable;
  notification_deliveries: NotificationDeliveryTable;
  notification_outbox: NotificationOutboxTable;
  notification_preferences: NotificationPreferenceTable;
  notifications: NotificationTable;
  project_board_columns: ProjectBoardColumnTable;
  project_memberships: ProjectMembershipTable;
  projects: ProjectTable;
  project_issue_labels: ProjectIssueLabelTable;
  schema_migrations: SchemaMigrationTable;
  sync_cursors: SyncCursorTable;
  user_identities: UserIdentityTable;
  users: UserTable;
  verification_tokens: VerificationTokenTable;
  webhook_deliveries: WebhookDeliveryTable;
  workspace_invitations: WorkspaceInvitationTable;
  workspace_memberships: WorkspaceMembershipTable;
  workspaces: WorkspaceTable;
};
