export function appendDatedAdminNote(
  existingNotes: string | null | undefined,
  message: string,
  now = new Date(),
) {
  const entry = `[${now.toISOString()}] ${message}`;
  const trimmedNotes = existingNotes?.trim();
  return trimmedNotes ? `${trimmedNotes}\n${entry}` : entry;
}
