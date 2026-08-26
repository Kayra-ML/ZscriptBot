import { describe, expect, it } from "vitest";
import { remainingText } from "./labels";

describe("remainingText", () => {
  it("lifetime is sinirsiz", () => {
    expect(remainingText(null)).toBe("Sinirsiz");
  });

  it("past date is expired", () => {
    expect(remainingText(new Date(Date.now() - 1000))).toBe("Suresi doldu");
  });
});
