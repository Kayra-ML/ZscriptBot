const MAX_CUSTOM_ID = 100;

export type CustomId = {
  area: string;
  action: string;
  entityId?: string;
};

export function encodeCustomId(area: string, action: string, entityId?: string): string {
  const id = entityId ? `${area}:${action}:${entityId}` : `${area}:${action}`;
  if (id.length > MAX_CUSTOM_ID) {
    throw new Error("custom_id 100 karakteri asiyor");
  }
  return id;
}

export function decodeCustomId(raw: string): CustomId | null {
  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const [area, action, ...rest] = parts;
  if (!area || !action) return null;
  const entityId = rest.length > 0 ? rest.join(":") : undefined;
  return { area, action, entityId };
}
