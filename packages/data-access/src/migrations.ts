import { sql } from "kysely";

import type { Database } from "./database";

type Migration = {
  name: string;
  statements: string[];
};

const migrations: Migration[] = [
  {
    name: "0001_initial_schema",
    statements: [
      `
      create table if not exists users (
        id text primary key,
        name text not null,
        email text null,
        created_at text not null,
        updated_at text not null
      )
      `,
      `
      create table if not exists user_identities (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        provider text not null,
        provider_user_id text not null,
        email text null,
        created_at text not null,
        unique (provider, provider_user_id)
      )
      `,
      `
      create table if not exists workspaces (
        id text primary key,
        name text not null,
        slug text not null unique,
        created_at text not null
      )
      `,
      `
      create table if not exists workspace_memberships (
        workspace_id text not null references workspaces(id) on delete cascade,
        user_id text not null,
        role text not null,
        created_at text not null,
        primary key (workspace_id, user_id)
      )
      `,
      `
      create table if not exists projects (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        name text not null,
        project_key text not null,
        visibility text not null,
        created_at text not null,
        updated_at text not null,
        unique (workspace_id, project_key)
      )
      `,
      `
      create table if not exists project_memberships (
        project_id text not null references projects(id) on delete cascade,
        user_id text not null,
        role text not null,
        created_at text not null,
        primary key (project_id, user_id)
      )
      `,
      `
      create table if not exists workspace_invitations (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        project_id text null references projects(id) on delete cascade,
        invitee_user_id text null references users(id) on delete cascade,
        invitee_email text null,
        role text not null,
        status text not null,
        invited_by_user_id text not null references users(id) on delete cascade,
        accepted_by_user_id text null references users(id) on delete set null,
        accepted_at text null,
        expires_at text not null,
        accept_token text null,
        created_at text not null,
        updated_at text not null,
        unique (accept_token)
      )
      `,
      `
      create table if not exists issues (
        id text primary key,
        project_id text not null references projects(id) on delete cascade,
        issue_number integer not null,
        issue_key text not null,
        title text not null,
        description text not null,
        state text not null,
        priority text not null,
        triage_status text not null,
        reporter_user_id text not null,
        assignee_user_id text null,
        due_at text null,
        created_at text not null,
        updated_at text not null,
        unique (project_id, issue_number),
        unique (issue_key)
      )
      `,
      `
      create table if not exists issue_comments (
        id text primary key,
        issue_id text not null references issues(id) on delete cascade,
        author_user_id text not null,
        body text not null,
        created_at text not null
      )
      `,
      `
      create table if not exists issue_source_links (
        id text primary key,
        issue_id text not null references issues(id) on delete cascade,
        provider text not null,
        external_id text not null,
        source_of_truth text not null,
        installation_id text null,
        external_project_id text null,
        external_key text null,
        external_url text null,
        last_synced_at text null,
        created_at text not null,
        unique (issue_id, provider, external_id)
      )
      `,
      `
      create table if not exists audit_events (
        id text primary key,
        actor_id text not null,
        action text not null,
        resource_id text not null,
        workspace_id text null,
        project_id text null,
        issue_id text null,
        payload text null,
        occurred_at text not null
      )
      `,
      `
      create index if not exists idx_projects_workspace_id on projects(workspace_id)
      `,
      `
      create index if not exists idx_project_memberships_user on project_memberships(user_id)
      `,
      `
      create index if not exists idx_workspace_memberships_user on workspace_memberships(user_id)
      `,
      `
      create index if not exists idx_user_identities_user_id on user_identities(user_id)
      `,
      `
      create index if not exists idx_workspace_invitations_workspace_id on workspace_invitations(workspace_id)
      `,
      `
      create index if not exists idx_workspace_invitations_project_id on workspace_invitations(project_id)
      `,
      `
      create index if not exists idx_workspace_invitations_status on workspace_invitations(status)
      `,
      `
      create index if not exists idx_workspace_invitations_invitee_user_id on workspace_invitations(invitee_user_id)
      `,
      `
      create index if not exists idx_workspace_invitations_invitee_email on workspace_invitations(invitee_email)
      `,
      `
      create index if not exists idx_issues_project_id on issues(project_id)
      `,
      `
      create index if not exists idx_issues_triage_status on issues(triage_status)
      `,
      `
      create index if not exists idx_issue_comments_issue_id on issue_comments(issue_id)
      `,
      `
      create index if not exists idx_audit_events_resource_id on audit_events(resource_id)
      `
    ]
  },
  {
    name: "0002_internal_auth_headers",
    statements: [
      `
      create table if not exists workspace_invitations (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        project_id text null references projects(id) on delete cascade,
        invitee_user_id text null references users(id) on delete cascade,
        invitee_email text null,
        role text not null,
        status text not null,
        invited_by_user_id text not null references users(id) on delete cascade,
        accepted_by_user_id text null references users(id) on delete set null,
        accepted_at text null,
        expires_at text not null,
        accept_token text null,
        created_at text not null,
        updated_at text not null,
        unique (accept_token)
      )
      `,
      `
      alter table workspace_invitations
      add column if not exists expires_at text
      `,
      `
      alter table workspace_invitations
      add column if not exists accept_token text
      `,
      `
      update workspace_invitations
      set expires_at = coalesce(expires_at, created_at)
      `,
      `
      create unique index if not exists idx_workspace_invitations_accept_token
      on workspace_invitations(accept_token)
      where accept_token is not null
      `
    ]
  },
  {
    name: "0003_membership_user_foreign_keys",
    statements: [
      `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'workspace_memberships_user_id_fkey'
        ) then
          alter table workspace_memberships
          add constraint workspace_memberships_user_id_fkey
          foreign key (user_id) references users(id) on delete cascade;
        end if;
      end
      $$;
      `,
      `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'project_memberships_user_id_fkey'
        ) then
          alter table project_memberships
          add constraint project_memberships_user_id_fkey
          foreign key (user_id) references users(id) on delete cascade;
        end if;
      end
      $$;
      `
    ]
  },
  {
    name: "0004_issue_key_scope",
    statements: [
      `
      alter table issues
      drop constraint if exists issues_issue_key_key
      `,
      `
      create unique index if not exists idx_issues_project_issue_key
      on issues(project_id, issue_key)
      `
    ]
  },
  {
    name: "0005_project_board_columns",
    statements: [
      `
      create table if not exists project_board_columns (
        project_id text not null references projects(id) on delete cascade,
        state text not null,
        label text not null,
        column_order integer not null,
        accent text not null,
        created_at text not null,
        updated_at text not null,
        primary key (project_id, state)
      )
      `,
      `
      create index if not exists idx_project_board_columns_project_id
      on project_board_columns(project_id)
      `,
      `
      create unique index if not exists idx_project_board_columns_project_order
      on project_board_columns(project_id, column_order)
      `
    ]
  },
  {
    name: "0006_integrations_foundation",
    statements: [
      `
      alter table issue_source_links
      add column if not exists installation_id text
      `,
      `
      alter table issue_source_links
      add column if not exists external_project_id text
      `,
      `
      alter table issue_source_links
      add column if not exists external_key text
      `,
      `
      alter table issue_source_links
      add column if not exists external_url text
      `,
      `
      alter table issue_source_links
      add column if not exists last_synced_at text
      `,
      `
      create table if not exists integration_installations (
        id text primary key,
        workspace_id text not null references workspaces(id) on delete cascade,
        provider text not null,
        external_account_id text not null,
        external_account_slug text null,
        auth_type text not null,
        status text not null,
        webhook_secret text null,
        created_by_user_id text not null,
        created_at text not null,
        updated_at text not null,
        unique (provider, external_account_id)
      )
      `,
      `
      create table if not exists integration_project_links (
        id text primary key,
        installation_id text not null references integration_installations(id) on delete cascade,
        project_id text not null references projects(id) on delete cascade,
        provider text not null,
        external_project_id text not null,
        external_project_path text not null,
        source_of_truth text not null,
        created_at text not null,
        updated_at text not null,
        last_imported_at text null,
        last_webhook_received_at text null,
        unique (provider, external_project_id),
        unique (project_id, provider)
      )
      `,
      `
      create table if not exists webhook_deliveries (
        id text primary key,
        provider text not null,
        provider_delivery_id text not null,
        installation_id text null references integration_installations(id) on delete set null,
        project_link_id text null references integration_project_links(id) on delete set null,
        event_type text not null,
        payload text not null,
        status text not null,
        error_message text null,
        received_at text not null,
        processed_at text null,
        unique (provider, provider_delivery_id)
      )
      `,
      `
      create table if not exists sync_cursors (
        id text primary key,
        project_link_id text not null references integration_project_links(id) on delete cascade,
        cursor text not null,
        updated_at text not null,
        unique (project_link_id)
      )
      `,
      `
      create index if not exists idx_integration_installations_workspace_id
      on integration_installations(workspace_id)
      `,
      `
      create index if not exists idx_integration_project_links_project_id
      on integration_project_links(project_id)
      `,
      `
      create index if not exists idx_webhook_deliveries_status
      on webhook_deliveries(status)
      `,
      `
      create index if not exists idx_webhook_deliveries_project_link_id
      on webhook_deliveries(project_link_id)
      `
    ]
  },
  {
    name: "0007_notifications_mentions_handles",
    statements: [
      `
      alter table users
      add column if not exists handle text
      `,
      `
      do $$
      declare
        user_row record;
        base_handle text;
        candidate_handle text;
        suffix integer;
      begin
        for user_row in select id, name, handle from users order by created_at asc loop
          if user_row.handle is not null and user_row.handle <> '' then
            continue;
          end if;

          base_handle := lower(regexp_replace(coalesce(user_row.name, ''), '[^a-z0-9]+', '_', 'g'));
          base_handle := regexp_replace(base_handle, '^_+|_+$', '', 'g');
          base_handle := regexp_replace(base_handle, '_+', '_', 'g');

          if char_length(base_handle) < 3 then
            base_handle := 'user';
          end if;

          base_handle := left(base_handle, 32);
          candidate_handle := base_handle;
          suffix := 0;

          while exists (
            select 1
            from users
            where lower(handle) = lower(candidate_handle)
              and id <> user_row.id
          ) loop
            suffix := suffix + 1;
            candidate_handle := left(base_handle, greatest(3, 32 - char_length(suffix::text))) || suffix::text;
          end loop;

          update users
          set handle = candidate_handle
          where id = user_row.id;
        end loop;
      end
      $$;
      `,
      `
      alter table users
      alter column handle set not null
      `,
      `
      create unique index if not exists idx_users_handle_lower
      on users (lower(handle))
      `,
      `
      create table if not exists issue_comment_mentions (
        comment_id text not null references issue_comments(id) on delete cascade,
        mentioned_user_id text not null references users(id) on delete cascade,
        mentioned_handle text not null,
        start_offset integer not null,
        end_offset integer not null,
        primary key (comment_id, mentioned_user_id, start_offset)
      )
      `,
      `
      create index if not exists idx_issue_comment_mentions_mentioned_user_id
      on issue_comment_mentions(mentioned_user_id)
      `,
      `
      create table if not exists notification_preferences (
        user_id text primary key references users(id) on delete cascade,
        in_app_enabled boolean not null default true,
        email_enabled boolean not null default false,
        updated_at text not null
      )
      `,
      `
      create table if not exists notification_category_preferences (
        user_id text not null references users(id) on delete cascade,
        category text not null,
        in_app_enabled boolean not null,
        email_enabled boolean not null,
        updated_at text not null,
        primary key (user_id, category)
      )
      `,
      `
      create table if not exists notifications (
        id text primary key,
        recipient_user_id text not null references users(id) on delete cascade,
        actor_user_id text null,
        category text not null,
        event_type text not null,
        workspace_id text null references workspaces(id) on delete set null,
        project_id text null references projects(id) on delete set null,
        issue_id text null references issues(id) on delete set null,
        invitation_id text null references workspace_invitations(id) on delete set null,
        title text not null,
        body text not null,
        href text not null,
        payload_json text not null,
        dedupe_key text not null,
        created_at text not null,
        seen_at text null,
        read_at text null,
        archived_at text null,
        unique (recipient_user_id, dedupe_key)
      )
      `,
      `
      create index if not exists idx_notifications_recipient_created_at
      on notifications(recipient_user_id, created_at desc)
      `,
      `
      create index if not exists idx_notifications_recipient_unseen
      on notifications(recipient_user_id, seen_at, archived_at)
      `,
      `
      create table if not exists notification_outbox (
        id text primary key,
        event_type text not null,
        aggregate_type text not null,
        aggregate_id text not null,
        workspace_id text null references workspaces(id) on delete set null,
        project_id text null references projects(id) on delete set null,
        issue_id text null references issues(id) on delete set null,
        invitation_id text null references workspace_invitations(id) on delete set null,
        actor_user_id text null,
        payload_json text not null,
        available_at text not null,
        status text not null,
        attempt_count integer not null default 0,
        last_error text null,
        locked_at text null,
        locked_by text null,
        processed_at text null,
        created_at text not null
      )
      `,
      `
      create index if not exists idx_notification_outbox_status_available_at
      on notification_outbox(status, available_at)
      `,
      `
      create table if not exists notification_deliveries (
        id text primary key,
        notification_id text null references notifications(id) on delete cascade,
        recipient_user_id text not null references users(id) on delete cascade,
        channel text not null,
        status text not null,
        scheduled_for text not null,
        sent_at text null,
        provider_message_id text null,
        error_message text null,
        created_at text not null,
        updated_at text not null
      )
      `,
      `
      create index if not exists idx_notification_deliveries_recipient_status
      on notification_deliveries(recipient_user_id, status)
      `
    ]
  },
  {
    name: "0008_issue_mentions_subscriptions",
    statements: [
      `
      create table if not exists issue_mentions (
        id text primary key,
        issue_id text not null references issues(id) on delete cascade,
        source_type text not null,
        comment_id text null references issue_comments(id) on delete cascade,
        mentioned_user_id text not null references users(id) on delete cascade,
        mentioned_handle text not null,
        start_offset integer not null,
        end_offset integer not null
      )
      `,
      `
      create index if not exists idx_issue_mentions_mentioned_user_id
      on issue_mentions(mentioned_user_id)
      `,
      `
      create index if not exists idx_issue_mentions_issue_id
      on issue_mentions(issue_id, source_type)
      `,
      `
      insert into issue_mentions (
        id,
        issue_id,
        source_type,
        comment_id,
        mentioned_user_id,
        mentioned_handle,
        start_offset,
        end_offset
      )
      select
        issue_comment_mentions.comment_id || ':' || issue_comment_mentions.mentioned_user_id || ':' || issue_comment_mentions.start_offset,
        issue_comments.issue_id,
        'comment',
        issue_comment_mentions.comment_id,
        issue_comment_mentions.mentioned_user_id,
        issue_comment_mentions.mentioned_handle,
        issue_comment_mentions.start_offset,
        issue_comment_mentions.end_offset
      from issue_comment_mentions
      inner join issue_comments on issue_comments.id = issue_comment_mentions.comment_id
      on conflict do nothing
      `,
      `
      create table if not exists issue_subscriptions (
        issue_id text not null references issues(id) on delete cascade,
        user_id text not null references users(id) on delete cascade,
        is_active boolean not null default true,
        manually_unsubscribed boolean not null default false,
        created_at text not null,
        updated_at text not null,
        primary key (issue_id, user_id)
      )
      `,
      `
      create index if not exists idx_issue_subscriptions_user_active
      on issue_subscriptions(user_id, is_active, updated_at desc)
      `,
      `
      create index if not exists idx_issue_subscriptions_issue_id
      on issue_subscriptions(issue_id)
      `
    ]
  },
  {
    name: "0009_issue_labels_due_dates_attachments",
    statements: [
      `
      alter table issues
      add column if not exists due_at text
      `,
      `
      create table if not exists project_issue_labels (
        id text primary key,
        project_id text not null references projects(id) on delete cascade,
        name text not null,
        color text not null,
        created_at text not null,
        updated_at text not null
      )
      `,
      `
      create unique index if not exists idx_project_issue_labels_project_name
      on project_issue_labels(project_id, lower(name))
      `,
      `
      create index if not exists idx_project_issue_labels_project_id
      on project_issue_labels(project_id)
      `,
      `
      insert into project_issue_labels (id, project_id, name, color, created_at, updated_at)
      select projects.id || ':label:bug', projects.id, 'Bug', 'red', now()::text, now()::text
      from projects
      on conflict do nothing
      `,
      `
      insert into project_issue_labels (id, project_id, name, color, created_at, updated_at)
      select projects.id || ':label:feature', projects.id, 'Feature', 'violet', now()::text, now()::text
      from projects
      on conflict do nothing
      `,
      `
      insert into project_issue_labels (id, project_id, name, color, created_at, updated_at)
      select projects.id || ':label:improvement', projects.id, 'Improvement', 'blue', now()::text, now()::text
      from projects
      on conflict do nothing
      `,
      `
      create table if not exists issue_label_assignments (
        issue_id text not null references issues(id) on delete cascade,
        label_id text not null references project_issue_labels(id) on delete cascade,
        created_at text not null,
        primary key (issue_id, label_id)
      )
      `,
      `
      create index if not exists idx_issue_label_assignments_label_id
      on issue_label_assignments(label_id)
      `,
      `
      create table if not exists issue_attachments (
        id text primary key,
        issue_id text not null references issues(id) on delete cascade,
        uploaded_by_user_id text not null references users(id) on delete cascade,
        storage_key text not null unique,
        file_name text not null,
        content_type text not null,
        byte_size integer not null,
        checksum text not null,
        created_at text not null,
        deleted_at text null
      )
      `,
      `
      create index if not exists idx_issue_attachments_issue_id_active
      on issue_attachments(issue_id, deleted_at)
      `
    ]
  },
  {
    name: "0010_issue_sub_issues",
    statements: [
      `
      alter table issues
      add column if not exists parent_issue_id text null
      `,
      `
      do $$
      begin
        if not exists (
          select 1
          from pg_constraint
          where conname = 'issues_parent_issue_id_fkey'
        ) then
          alter table issues
          add constraint issues_parent_issue_id_fkey
          foreign key (parent_issue_id) references issues(id) on delete set null;
        end if;
      end
      $$;
      `,
      `
      create index if not exists idx_issues_parent_issue_id
      on issues(parent_issue_id)
      `
    ]
  },
  {
    name: "0011_issue_reactions",
    statements: [
      `
      create table if not exists issue_reactions (
        issue_id text not null references issues(id) on delete cascade,
        user_id text not null references users(id) on delete cascade,
        emoji text not null,
        created_at text not null,
        primary key (issue_id, user_id, emoji)
      )
      `,
      `
      create index if not exists idx_issue_reactions_issue_id
      on issue_reactions(issue_id, created_at)
      `,
      `
      create index if not exists idx_issue_reactions_user_id
      on issue_reactions(user_id, created_at desc)
      `
    ]
  },
  {
    name: "0012_project_board_icons",
    statements: [
      `
      alter table project_board_columns
      add column if not exists icon_key text
      `,
      `
      update project_board_columns
      set icon_key = case state
        when 'backlog' then 'circle_dashed'
        when 'todo' then 'list_todo'
        when 'in_progress' then 'loader_circle'
        when 'done' then 'check_circle_2'
        when 'canceled' then 'ban'
        else 'circle_dashed'
      end
      where icon_key is null
      `,
      `
      alter table project_board_columns
      alter column icon_key set not null
      `
    ]
  },
  {
    name: "0013_comment_threads",
    statements: [
      `
      alter table issue_comments
      add column if not exists parent_comment_id text null references issue_comments(id) on delete cascade
      `,
      `
      create index if not exists idx_issue_comments_parent_comment_id
      on issue_comments(parent_comment_id)
      `
    ]
  },
  {
    name: "0014_issue_comment_reactions",
    statements: [
      `
      create table if not exists issue_comment_reactions (
        comment_id text not null references issue_comments(id) on delete cascade,
        user_id text not null references users(id) on delete cascade,
        emoji text not null,
        created_at text not null,
        primary key (comment_id, user_id, emoji)
      )
      `,
      `
      create index if not exists idx_issue_comment_reactions_comment_id
      on issue_comment_reactions(comment_id)
      `
    ]
  }
];

export const getMigrationNames = (): string[] => migrations.map((migration) => migration.name);

export const runMigrations = async (database: Database): Promise<void> => {
  const baselineMigration = migrations[0];

  if (baselineMigration) {
    await database.transaction().execute(async (trx) => {
      for (const statement of baselineMigration.statements) {
        await sql.raw(statement).execute(trx);
      }
    });
  }

  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at text not null
    )
  `.execute(database);

  const appliedRows = await database
    .selectFrom("schema_migrations")
    .select("name")
    .execute();

  const applied = new Set(appliedRows.map((row) => row.name));

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    await database.transaction().execute(async (trx) => {
      for (const statement of migration.statements) {
        await sql.raw(statement).execute(trx);
      }

      await trx
        .insertInto("schema_migrations")
        .values({
          applied_at: new Date().toISOString(),
          name: migration.name
        })
        .execute();
    });
  }
};

export const truncateAllTables = async (database: Database): Promise<void> => {
  await sql.raw(`
    truncate table
      audit_events,
      integration_installations,
      integration_project_links,
      notification_deliveries,
      notification_outbox,
      notifications,
      notification_category_preferences,
      notification_preferences,
      webhook_deliveries,
      sync_cursors,
      issue_source_links,
      issue_attachments,
      issue_label_assignments,
      issue_mentions,
      issue_reactions,
      issue_subscriptions,
      issue_comment_mentions,
      issue_comments,
      issues,
      project_board_columns,
      project_issue_labels,
      project_memberships,
      projects,
      workspace_invitations,
      workspace_memberships,
      user_identities,
      users,
      workspaces
    restart identity cascade
  `).execute(database);
};
