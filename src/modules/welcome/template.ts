export const DEFAULT_WELCOME_MESSAGE = [
  "Hoş geldin, {user}!",
  "",
  "{server} sunucusuna hoş geldin.",
  "Kuralları okumayı ve ürünlerimize göz atmayı unutma.",
  "Seninle birlikte artık {memberCount} kişiyiz.",
].join("\n");

const PLACEHOLDERS = ["{user}", "{username}", "{server}", "{memberCount}"] as const;

export type WelcomeVars = {
  user: string;
  username: string;
  server: string;
  memberCount: string;
};

export function renderWelcomeMessage(template: string | null | undefined, vars: WelcomeVars): string {
  const raw = (template && template.trim()) || DEFAULT_WELCOME_MESSAGE;
  return raw
    .replaceAll("{user}", vars.user)
    .replaceAll("{username}", vars.username)
    .replaceAll("{server}", vars.server)
    .replaceAll("{memberCount}", vars.memberCount);
}

export function welcomeTemplateHint(): string {
  return PLACEHOLDERS.join("  ");
}
