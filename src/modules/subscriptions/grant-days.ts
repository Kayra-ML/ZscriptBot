import { DomainError } from "../../lib/errors";

export function parseGrantDays(days: number | null): { timed: boolean; days: number | null } {
  if (days === null) return { timed: false, days: null };
  if (!Number.isInteger(days) || days < 1) {
    throw new DomainError("Sure bos (sinirsiz) veya 1+ gun olmali.");
  }
  return { timed: true, days };
}
