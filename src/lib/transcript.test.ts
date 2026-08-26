import { describe, expect, it } from "vitest";
import { formatTranscript } from "./transcript";

describe("formatTranscript", () => {
  it("joins messages in order", () => {
    const text = formatTranscript([
      {
        authorId: "u1",
        content: "merhaba",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    expect(text).toContain("u1: merhaba");
    expect(text).toContain("2026-01-01");
  });
});
