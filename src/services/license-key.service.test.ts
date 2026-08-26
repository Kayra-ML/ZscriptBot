import { describe, expect, it } from "vitest";
import { generateLicenseKey } from "./license-key.service";

describe("license key", () => {
  it("matches ZSC-XXXX-XXXX-XXXX", () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^ZSC-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});
