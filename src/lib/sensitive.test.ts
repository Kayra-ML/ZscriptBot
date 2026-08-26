import { describe, expect, it } from "vitest";
import { containsSensitive } from "./sensitive";

describe("sensitive input", () => {
  it("rejects card-like numbers", () => {
    expect(containsSensitive("4111111111111111")).toBe(true);
    expect(containsSensitive("cvv 123")).toBe(true);
  });

  it("allows a tx hash note", () => {
    expect(containsSensitive("txid abcdef123")).toBe(false);
  });
});
