import { PermissionFlagsBits, type Guild, type Role } from "discord.js";
import { DomainError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";
import { ACTIVE_LIKE } from "../subscriptions/service";

const BLOCKED_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
] as const;

export function isUnsafeGrantRole(role: Role, botHighestPosition: number): boolean {
  if (BLOCKED_PERMS.some((p) => role.permissions.has(p))) return true;
  return role.position >= botHighestPosition;
}

export function assertSafeGrantRole(role: Role, botHighestPosition: number) {
  if (isUnsafeGrantRole(role, botHighestPosition)) {
    throw new DomainError(
      "Bu rol Administrator / Manage Guild / Manage Roles iceriyor veya bot rolunden yuksek. Verilemez.",
    );
  }
}

export async function addRoles(guild: Guild, userId: string, roleIds: (string | null | undefined)[]) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  const botPos = guild.members.me?.roles.highest.position ?? 0;
  const ids = [...new Set(roleIds.filter((id): id is string => Boolean(id)))];
  for (const id of ids) {
    const role = guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
    if (!role || isUnsafeGrantRole(role, botPos)) continue;
    await member.roles.add(id).catch(() => undefined);
  }
}

export async function removeRole(guild: Guild, userId: string, roleId: string | null | undefined) {
  if (!roleId) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;
  await member.roles.remove(roleId).catch(() => undefined);
}

export async function removeProductRoleIfUnused(
  guild: Guild,
  userId: string,
  productId: string,
  productRoleId: string | null | undefined,
) {
  if (!productRoleId) return;
  const still = await prisma.subscription.count({
    where: {
      guildId: guild.id,
      userId,
      productId,
      status: { in: ACTIVE_LIKE },
    },
  });
  if (still > 0) return;
  await removeRole(guild, userId, productRoleId);
}
