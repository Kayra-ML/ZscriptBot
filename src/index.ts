import { env } from "./env";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { createClient } from "./bot/client";
import { onReady } from "./bot/events/ready";
import { onGuildCreate } from "./bot/events/guildCreate";
import { onMessageCreate } from "./bot/events/messageCreate";
import { onGuildMemberAdd } from "./bot/events/guildMemberAdd";
import { routeInteraction } from "./bot/interactions/router";
import { startJobs } from "./jobs/queues";

async function main() {
  await redis.connect();
  await redis.ping();
  await prisma.$connect();

  const client = createClient();
  const jobs = startJobs(client);

  client.once("ready", () => {
    void onReady(client).catch((err) => console.error("ready", err));
  });
  client.on("guildCreate", (guild) => {
    void onGuildCreate(guild).catch((err) => console.error("guildCreate", err));
  });
  client.on("messageCreate", (message) => {
    void onMessageCreate(message).catch((err) => console.error("messageCreate", err));
  });
  client.on("guildMemberAdd", (member) => {
    void onGuildMemberAdd(member).catch((err) => console.error("guildMemberAdd", err));
  });
  client.on("interactionCreate", (interaction) => {
    void routeInteraction(interaction).catch((err) => {
      console.error("interaction error", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        void interaction.reply({ content: "Beklenmeyen hata.", ephemeral: true });
      }
    });
  });

  const shutdown = async () => {
    await jobs.sweepWorker.close();
    await jobs.warnWorker.close();
    await jobs.sweep.close();
    await jobs.warn.close();
    client.destroy();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
