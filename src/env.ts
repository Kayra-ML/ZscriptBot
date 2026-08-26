import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  GUILD_ID: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

