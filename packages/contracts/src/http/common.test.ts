import { describe, expect, it } from "vitest";

import { errorEnvelopeSchema, paginationSchema } from "./common";

describe("contracts", () => {
  it("validates pagination payloads", () => {
    expect(
      paginationSchema.safeParse({
        page: 1,
        pageSize: 25,
        total: 120
      }).success
    ).toBe(true);
  });

  it("requires error envelopes to include a code and message", () => {
    expect(
      errorEnvelopeSchema.safeParse({
        code: "forbidden",
        message: "Access denied"
      }).success
    ).toBe(true);
  });
});
