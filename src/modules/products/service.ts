import { ProductStatus, type Product } from "@prisma/client";
import { DomainError } from "../../lib/errors";
import { prisma } from "../../lib/prisma";

export async function listActive(guildId: string): Promise<Product[]> {
  return prisma.product.findMany({
    where: { guildId, status: "ACTIVE" },
    orderBy: { name: "asc" },
  });
}

export async function listAll(guildId: string): Promise<Product[]> {
  return prisma.product.findMany({ where: { guildId }, orderBy: { name: "asc" } });
}

export async function createProduct(input: {
  guildId: string;
  name: string;
  description: string;
  listPrice: string;
  version?: string;
  roleId?: string | null;
  stock?: number | null;
  durationDays?: number | null;
}): Promise<Product> {
  const price = Number(input.listPrice.replace(",", "."));
  if (!Number.isFinite(price) || price < 0) throw new DomainError("Gecersiz fiyat.");
  return prisma.product.create({
    data: {
      guildId: input.guildId,
      name: input.name.trim(),
      description: input.description.trim(),
      listPrice: price,
      version: input.version?.trim() || "1.0",
      roleId: input.roleId ?? null,
      stock: input.stock ?? null,
      durationDays: input.durationDays ?? null,
    },
  });
}

export async function deleteProduct(id: string, guildId: string) {
  const product = await prisma.product.findFirst({
    where: { id, guildId },
    include: {
      _count: {
        select: { orders: true, licenses: true, subscriptions: true },
      },
    },
  });
  if (!product) throw new DomainError("Urun bulunamadi.");

  const hasSales =
    product._count.orders > 0 ||
    product._count.licenses > 0 ||
    product._count.subscriptions > 0;

  if (hasSales) {
    const updated = await prisma.product.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });
    return { status: "ARCHIVED", product: updated };
  } else {
    const deleted = await prisma.product.delete({ where: { id } });
    return { status: "DELETED", product: deleted };
  }
}

export async function setProductStatus(id: string, guildId: string, status: ProductStatus) {
  const product = await prisma.product.findFirst({ where: { id, guildId } });
  if (!product) throw new DomainError("Urun bulunamadi.");
  return prisma.product.update({ where: { id }, data: { status } });
}

export async function getProduct(id: string, guildId: string) {
  return prisma.product.findFirst({ where: { id, guildId } });
}
