import { describe, expect, it } from "vitest";
import { commandPayload } from "./commands";

describe("slash command names", () => {
  it("registers Turkish V1 commands", () => {
    const names = commandPayload().map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "kurulum",
        "ürünler",
        "siparişler",
        "lisans",
        "profil",
        "abone",
        "ürün-ekle",
        "abone-ver",
      ]),
    );
  });
});
