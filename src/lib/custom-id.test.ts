import { describe, expect, it } from "vitest";
import { decodeCustomId, encodeCustomId } from "./custom-id";

describe("custom-id", () => {
  it("encodes area:action:uuid under 100 chars", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const id = encodeCustomId("tkt", "pay", uuid);
    expect(id).toBe(`tkt:pay:${uuid}`);
    expect(id.length).toBeLessThan(100);
  });

  it("decodes and round-trips", () => {
    const raw = encodeCustomId("set", "ok", "orderLogChannelId");
    expect(decodeCustomId(raw)).toEqual({
      area: "set",
      action: "ok",
      entityId: "orderLogChannelId",
    });
  });

  it("returns null for garbage", () => {
    expect(decodeCustomId("nope")).toBeNull();
  });
});
