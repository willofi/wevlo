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
      webhook_deliveries,
      sync_cursors,
      issue_source_links,
      issue_comments,
      issues,
      project_board_columns,
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
