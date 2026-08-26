import { describe, expect, it } from "vitest";
import { formatPublicId } from "./id.service";

describe("formatPublicId", () => {
  it("pads ticket ids", () => {
    expect(formatPublicId("ticket", 1)).toBe("TCK-000001");
    expect(formatPublicId("order", 42)).toBe("ORD-000042");
    expect(formatPublicId("payment", 7)).toBe("PAY-000007");
    expect(formatPublicId("subscription", 12)).toBe("SUB-000012");
  });
});
