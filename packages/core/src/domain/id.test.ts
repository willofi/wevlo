import { describe, expect, it } from "vitest";

import {
  buildProjectKeyCandidates,
  buildWorkspaceSlugCandidates,
  createEntityId,
  normalizeProjectKey,
  normalizeWorkspaceSlug
} from "./id";

describe("createEntityId", () => {
  it("prefixes generated ids to keep aggregate identity readable", () => {
    expect(createEntityId("workspace")).toMatch(/^workspace_/);
  });
});

describe("identifier normalization", () => {
  it("normalizes workspace slugs into route-safe values", () => {
    expect(normalizeWorkspaceSlug("  Atlas Labs  ")).toBe("atlas-labs");
    expect(normalizeWorkspaceSlug("###")).toBe("workspace");
  });

  it("normalizes project keys into short uppercase tokens", () => {
    expect(normalizeProjectKey("Issue Hub")).toBe("ISSUEHUB");
    expect(normalizeProjectKey("platform")).toBe("PLATFORM");
  });

  it("builds collision candidates for generated workspace slugs and project keys", () => {
    expect(buildWorkspaceSlugCandidates("Atlas Labs", 3)).toEqual(["atlas-labs", "atlas-labs-2", "atlas-labs-3"]);
    expect(buildProjectKeyCandidates("Issue Hub", 3)).toEqual(["IH", "IH2", "IH3"]);
  });
});
