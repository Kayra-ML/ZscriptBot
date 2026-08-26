import { prisma } from "../../lib/prisma";

export async function listUserLicenses(guildId: string, userId: string) {
  return prisma.license.findMany({
    where: { guildId, userId },
    include: { product: true, order: true },
    orderBy: { createdAt: "desc" },
  });
}
