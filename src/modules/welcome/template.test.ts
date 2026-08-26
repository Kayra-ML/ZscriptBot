import { describe, expect, it } from "vitest";
import { DEFAULT_WELCOME_MESSAGE, renderWelcomeMessage } from "./template";

const vars = {
  user: "<@u1>",
  username: "ali",
  server: "Script Hub",
  memberCount: "42",
};

describe("renderWelcomeMessage", () => {
  it("replaces placeholders without executing code", () => {
    const out = renderWelcomeMessage(
      "Hoş geldin {user}! {server} ailesinin {memberCount}. üyesisin. {username}",
      vars,
    );
    expect(out).toBe("Hoş geldin <@u1>! Script Hub ailesinin 42. üyesisin. ali");
    expect(out).not.toContain("{user}");
  });

  it("uses default when template empty", () => {
    expect(renderWelcomeMessage(null, vars)).toContain("<@u1>");
    expect(renderWelcomeMessage("   ", vars)).toContain("42");
    expect(DEFAULT_WELCOME_MESSAGE).toContain("{user}");
  });

  it("does not eval expressions", () => {
    const out = renderWelcomeMessage("{user} ${process.exit(1)} {username}", vars);
    expect(out).toBe("<@u1> ${process.exit(1)} ali");
  });
});
