import type { Client } from "discord.js";
import { registerCommands } from "../register-commands";
import { ensureGuild } from "../../services/guild.service";

export async function onReady(client: Client) {
  if (!client.user) return;
  console.log(`Giris: ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (err) {
    console.error("slash kayit hatasi", err);
  }
  for (const [, guild] of client.guilds.cache) {
    await ensureGuild(guild.id, guild.name);
  }
}
