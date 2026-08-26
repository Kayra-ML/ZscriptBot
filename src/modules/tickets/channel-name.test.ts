import { describe, expect, it } from "vitest";
import { ticketChannelName as channelName } from "../../lib/labels";

describe("channelName", () => {
  it("builds tck-000001-script under 100 chars", () => {
    const name = channelName("TCK-000001", "SCRIPT_PURCHASE");
    expect(name).toBe("tck-000001-script");
    expect(name.length).toBeLessThanOrEqual(100);
  });
});
