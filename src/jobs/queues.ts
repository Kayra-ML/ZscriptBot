import { Queue, Worker, type ConnectionOptions } from "bullmq";
import type { Client } from "discord.js";
import { env } from "../env";
import { runSubscriptionSweep } from "./subscription-sweep";
import { runSubscriptionWarn } from "./subscription-warn";

function connection(): ConnectionOptions {
  const u = new URL(env.REDIS_URL);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    maxRetriesPerRequest: null,
  };
}

export function startJobs(client: Client) {
  const conn = connection();
  const sweep = new Queue("subscription.sweep", { connection: conn });
  const warn = new Queue("subscription.warn", { connection: conn });

  const sweepWorker = new Worker(
    "subscription.sweep",
    async () => {
      await runSubscriptionSweep(client);
    },
    { connection: conn },
  );
  const warnWorker = new Worker(
    "subscription.warn",
    async () => {
      await runSubscriptionWarn(client);
    },
    { connection: conn },
  );

  sweepWorker.on("failed", (job, err) => {
    console.error("sweep failed", job?.id, err);
  });
  warnWorker.on("failed", (job, err) => {
    console.error("warn failed", job?.id, err);
  });

  void sweep.add("tick", {}, { repeat: { every: 60_000 }, removeOnComplete: 50 });
  void warn.add("tick", {}, { repeat: { every: 300_000 }, removeOnComplete: 50 });

  return { sweep, warn, sweepWorker, warnWorker };
}
