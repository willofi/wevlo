import { describe, expect, it } from "vitest";

import { getRequestStatus, isRequestStatus } from "@/lib/request-error";

describe("request-error helpers", () => {
  it("parses http status codes from request failures", () => {
    const error = new Error("Request failed: 403 Forbidden");

    expect(getRequestStatus(error)).toBe(403);
    expect(isRequestStatus(error, 403)).toBe(true);
    expect(isRequestStatus(error, 404)).toBe(false);
  });

  it("ignores non-request errors", () => {
    expect(getRequestStatus(new Error("Boom"))).toBeNull();
    expect(getRequestStatus("boom")).toBeNull();
  });
});

