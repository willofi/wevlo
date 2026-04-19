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
      "0006_integrations_foundation"
    ]);
  });
});
