import type { Guild } from "discord.js";
import { ensureGuild } from "../../services/guild.service";

export async function onGuildCreate(guild: Guild) {
  await ensureGuild(guild.id, guild.name);
}
