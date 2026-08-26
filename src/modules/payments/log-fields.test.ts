import { describe, expect, it } from "vitest";
import { paymentLogFields } from "./log-fields";

describe("payment log embed", () => {
  it("does not include wallet address or card data", () => {
    const fields = paymentLogFields({
      paymentPublicId: "PAY-000001",
      orderPublicId: "ORD-000001",
      userId: "user-a",
      productName: "Script",
      amount: "100.00",
      currency: "TRY",
      confirmedBy: "staff-a",
      confirmedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const blob = JSON.stringify(fields);
    expect(blob).not.toMatch(/adres|wallet|kart|cvv|iban/i);
    expect(fields.some((f) => f.name === "Yontem" && f.value === "CRYPTO")).toBe(true);
  });
});
