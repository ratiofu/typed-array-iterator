export function notSpecificEnough(tokens: readonly string[]): boolean {
  return !(tokens.length > 1 || tokens.some((t) => t.length > 1))
}
