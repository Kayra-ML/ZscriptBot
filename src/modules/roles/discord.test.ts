import { PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { describe, expect, it } from "vitest";
import { isUnsafeGrantRole } from "./discord";

function role(perms: bigint[], position: number) {
  return {
    permissions: new PermissionsBitField(perms),
    position,
  } as unknown as import("discord.js").Role;
}

describe("isUnsafeGrantRole", () => {
  it("blocks Administrator", () => {
    expect(isUnsafeGrantRole(role([PermissionFlagsBits.Administrator], 1), 10)).toBe(true);
  });

  it("blocks ManageRoles and ManageGuild", () => {
    expect(isUnsafeGrantRole(role([PermissionFlagsBits.ManageRoles], 1), 10)).toBe(true);
    expect(isUnsafeGrantRole(role([PermissionFlagsBits.ManageGuild], 1), 10)).toBe(true);
  });

  it("blocks roles at or above the bot", () => {
    expect(isUnsafeGrantRole(role([], 10), 10)).toBe(true);
    expect(isUnsafeGrantRole(role([], 11), 10)).toBe(true);
  });

  it("allows a lower customer role", () => {
    expect(isUnsafeGrantRole(role([], 3), 10)).toBe(false);
  });
});
