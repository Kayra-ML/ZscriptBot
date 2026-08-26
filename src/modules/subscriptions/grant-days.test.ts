import { describe, expect, it } from "vitest";
import { DomainError } from "../../lib/errors";
import { parseGrantDays } from "./grant-days";

describe("parseGrantDays", () => {
  it("null is lifetime", () => {
    expect(parseGrantDays(null)).toEqual({ timed: false, days: null });
  });

  it("rejects 0 and negative", () => {
    expect(() => parseGrantDays(0)).toThrow(DomainError);
    expect(() => parseGrantDays(-5)).toThrow(DomainError);
  });

  it("accepts 1+", () => {
    expect(parseGrantDays(30)).toEqual({ timed: true, days: 30 });
  });
});
