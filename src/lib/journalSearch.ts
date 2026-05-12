export type SearchableJournalEntry = {
  id: string;
  note?: string | null;
  entry_type?: string | null;
  plant_name?: string;
  plant_display_name?: string;
  plant_display_names?: string[];
  created_at: string;
};

function buildHaystack(entry: SearchableJournalEntry): string {
  const parts: string[] = [];
  if (entry.note) parts.push(entry.note);
  if (entry.entry_type) parts.push(entry.entry_type.replace(/_/g, " "));
  if (entry.plant_name) parts.push(entry.plant_name);
  if (entry.plant_display_name) parts.push(entry.plant_display_name);
  if (entry.plant_display_names?.length) parts.push(...entry.plant_display_names);
  if (entry.created_at) {
    try {
      parts.push(new Date(entry.created_at).toLocaleDateString());
    } catch {
      // ignore invalid dates
    }
  }
  return parts.join(" ").toLowerCase();
}

export function filterJournalEntries<T extends SearchableJournalEntry>(
  entries: T[],
  query: string
): T[] {
  const trimmed = query.trim();
  if (!trimmed) return entries;
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = buildHaystack(entry);
    return tokens.every((token) => haystack.includes(token));
  });
}
