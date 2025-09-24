const RE = /[.*+?^${}()|[\]\\]/g

export function escapeRegExp(s: string): string {
  return s.replace(RE, '\\$&')
}
