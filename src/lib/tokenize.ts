export function tokenize(query: string): string[] {
  return query.split(/\s+/).filter((t) => t.length > 0)
}
