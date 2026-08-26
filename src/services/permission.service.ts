import type { GuildSettings, Ticket } from "@prisma/client";

export type Actor = {
  userId: string;
  guildId: string;
  isGuildOwner: boolean;
  isAdministrator: boolean;
  roleIds: string[];
};

export type Action =
  | "setup.write"
  | "ticket.open"
  | "ticket.staff"
  | "ticket.assign"
  | "ticket.participant"
  | "product.crud"
  | "subscription.admin"
  | "project.manage"
  | "self.read";

function hasRole(actor: Actor, roleId: string | null | undefined): boolean {
  return Boolean(roleId && actor.roleIds.includes(roleId));
}

export function isStaff(actor: Actor, settings: GuildSettings | null): boolean {
  if (actor.isAdministrator || actor.isGuildOwner) return true;
  if (!settings) return false;
  return (
    hasRole(actor, settings.supportRoleId) ||
    hasRole(actor, settings.adminRoleId) ||
    hasRole(actor, settings.ownerRoleId)
  );
}

export function isAdminOps(actor: Actor, settings: GuildSettings | null): boolean {
  if (actor.isAdministrator || actor.isGuildOwner) return true;
  if (!settings) return false;
  return hasRole(actor, settings.adminRoleId) || hasRole(actor, settings.ownerRoleId);
}

export function canBypassTicketLimits(actor: Actor, settings: GuildSettings | null): boolean {
  return isStaff(actor, settings);
}

export function canPerform(
  action: Action,
  actor: Actor,
  settings: GuildSettings | null,
  _ticket?: Pick<Ticket, "guildId" | "openerId" | "assigneeId"> | null,
): boolean {
  switch (action) {
    case "setup.write":
      return actor.isGuildOwner || actor.isAdministrator;
    case "ticket.open":
    case "self.read":
      return true;
    case "ticket.staff":
    case "ticket.assign":
    case "ticket.participant":
      return isStaff(actor, settings);
    case "product.crud":
    case "subscription.admin":
      return isAdminOps(actor, settings);
    case "project.manage":
      return isAdminOps(actor, settings) || hasRole(actor, settings?.developerRoleId);
    default:
      return false;
  }
}

export function assertGuildTicket(ticket: { guildId: string }, guildId: string): boolean {
  return ticket.guildId === guildId;
}

export function isTicketMember(
  actor: Actor,
  ticket: Pick<Ticket, "openerId" | "assigneeId">,
  participantIds: string[],
): boolean {
  return (
    ticket.openerId === actor.userId ||
    ticket.assigneeId === actor.userId ||
    participantIds.includes(actor.userId)
  );
}
