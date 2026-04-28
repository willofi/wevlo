import { describe, expect, it } from "vitest";

import { getMigrationNames } from "./migrations";

describe("migrations", () => {
  it("includes the alpha hardening migrations in order", () => {
    expect(getMigrationNames()).toEqual([
      "0001_initial_schema",
      "0002_internal_auth_headers",
      "0003_membership_user_foreign_keys",
      "0004_issue_key_scope",
      "0005_project_board_columns",
      "0006_integrations_foundation",
      "0007_notifications_mentions_handles",
      "0008_issue_mentions_subscriptions",
      "0009_issue_labels_due_dates_attachments",
      "0010_issue_sub_issues",
      "0011_issue_reactions",
      "0012_project_board_icons",
      "0013_comment_threads",
      "0014_issue_comment_reactions",
      "0015_verification_tokens",
      "0016_user_avatars"
    ]);
  });
});
