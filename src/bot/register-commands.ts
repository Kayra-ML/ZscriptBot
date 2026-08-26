import { REST, Routes } from "discord.js";
import { env } from "../env";
import { commandPayload } from "./commands";

export { commandPayload };

export async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  if (env.GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), {
      body: commandPayload(),
    });
    console.log(`Commands registered to guild: ${env.GUILD_ID}`);
    
    // Eski global komutları sil ki çift görünmesinler
    await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: [] });
    console.log("Old global commands cleared to prevent duplicates.");
  } else {
    await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: commandPayload() });
    console.log("Commands registered globally");
  }
}
