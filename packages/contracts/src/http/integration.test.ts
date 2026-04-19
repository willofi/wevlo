import { describe, expect, it } from "vitest";

import {
  createIntegrationInstallationRequestSchema,
  createIntegrationProjectLinkRequestSchema,
  importIntegrationProjectIssuesRequestSchema
} from "./integration";

describe("integration contracts", () => {
  it("rejects local-only source ownership for remote project links", () => {
    expect(
      createIntegrationProjectLinkRequestSchema.safeParse({
        externalProjectId: "123",
        externalProjectPath: "org/repo",
        installationId: "installation_1",
        sourceOfTruth: "remote"
      }).success
    ).toBe(true);

    expect(
      createIntegrationProjectLinkRequestSchema.safeParse({
        externalProjectId: "123",
        externalProjectPath: "org/repo",
        installationId: "installation_1",
        sourceOfTruth: "local"
      }).success
    ).toBe(false);
  });

  it("accepts installation setup with optional webhook secret", () => {
    expect(
      createIntegrationInstallationRequestSchema.safeParse({
        authType: "app",
        externalAccountId: "42",
        externalAccountSlug: "octo-org"
      }).success
    ).toBe(true);
  });

  it("accepts canonical remote issue import payloads", () => {
    expect(
      importIntegrationProjectIssuesRequestSchema.safeParse({
        issues: [
          {
            authorId: "octocat",
            comments: [],
            externalId: "101",
            externalProjectId: "42",
            state: "open",
            title: "Broken sync"
          }
        ]
      }).success
    ).toBe(true);
  });
});
