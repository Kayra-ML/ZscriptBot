import { Client, GatewayIntentBits, Partials } from "discord.js";

export function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });
}
