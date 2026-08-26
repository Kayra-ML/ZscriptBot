import { CounterKind, Prisma } from "@prisma/client";

const PREFIX: Record<CounterKind, string> = {
  ticket: "TCK",
  order: "ORD",
  payment: "PAY",
  project: "PRJ",
  license: "LIC",
  subscription: "SUB",
};

export function formatPublicId(kind: CounterKind, n: number): string {
  return `${PREFIX[kind]}-${String(n).padStart(6, "0")}`;
}

export async function nextPublicId(
  tx: Prisma.TransactionClient,
  guildId: string,
  kind: CounterKind,
): Promise<string> {
  const row = await tx.idCounter.upsert({
    where: { guildId_kind: { guildId, kind } },
    create: { guildId, kind, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatPublicId(kind, row.value);
}
