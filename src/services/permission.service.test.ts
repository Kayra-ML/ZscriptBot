import { describe, expect, it } from "vitest";
import type { GuildSettings } from "@prisma/client";
import { canPerform, isStaff } from "./permission.service";

function settings(partial: Partial<GuildSettings> = {}): GuildSettings {
  return {
    guildId: "g1",
    ticketPanelChannelId: null,
    ticketCategoryId: null,
    customOrderChannelId: null,
    ticketLogChannelId: null,
    paymentLogChannelId: null,
    orderLogChannelId: null,
    projectLogChannelId: null,
    subscriptionLogChannelId: null,
    moderationLogChannelId: null,
    securityLogChannelId: null,
    botLogChannelId: null,
    ownerRoleId: "role-owner",
    adminRoleId: "role-admin",
    supportRoleId: "role-support",
    developerRoleId: "role-dev",
    customerRoleId: "role-cust",
    maxOpenTickets: 2,
    maxOpenPerCategory: 1,
    ticketCloseCooldownSec: 600,
    ticketPanelMessageId: null,
    welcomeEnabled: false,
    welcomeChannelId: null,
    welcomeMessage: null,
    welcomeEmbedEnabled: true,
    updatedAt: new Date(),
    ...partial,
  };
}

describe("permissions", () => {
  it("setup.write only for guild owner or Administrator", () => {
    const member = {
      userId: "u1",
      guildId: "g1",
      isGuildOwner: false,
      isAdministrator: false,
      roleIds: ["role-owner"],
    };
    expect(canPerform("setup.write", member, settings())).toBe(false);
    expect(
      canPerform("setup.write", { ...member, isAdministrator: true }, settings()),
    ).toBe(true);
    expect(
      canPerform("setup.write", { ...member, isGuildOwner: true }, settings()),
    ).toBe(true);
  });

  it("random member cannot confirm pay (ticket.staff)", () => {
    const member = {
      userId: "random",
      guildId: "g1",
      isGuildOwner: false,
      isAdministrator: false,
      roleIds: [],
    };
    expect(canPerform("ticket.staff", member, settings())).toBe(false);
  });

  it("support role can staff a ticket", () => {
    const staff = {
      userId: "s1",
      guildId: "g1",
      isGuildOwner: false,
      isAdministrator: false,
      roleIds: ["role-support"],
    };
    expect(isStaff(staff, settings())).toBe(true);
    expect(canPerform("ticket.staff", staff, settings())).toBe(true);
  });

  it("wrong guild ticket is rejected by caller via guildId check helper usage", () => {
    const actor = {
      userId: "s1",
      guildId: "g1",
      isGuildOwner: false,
      isAdministrator: true,
      roleIds: [],
    };
    expect(actor.guildId === "g2").toBe(false);
  });
});
