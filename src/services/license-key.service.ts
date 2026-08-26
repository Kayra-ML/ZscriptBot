import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function chunk(): string {
  const bytes = randomBytes(4);
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function generateLicenseKey(): string {
  return `ZSC-${chunk()}-${chunk()}-${chunk()}`;
}
