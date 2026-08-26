export function formatTranscript(
  messages: { authorId: string; content: string; createdAt: Date }[],
): string {
  return messages
    .map((m) => `[${m.createdAt.toISOString()}] ${m.authorId}: ${m.content}`)
    .join("\n");
}
