import { escapeRegExp } from './escapeRegExp'

export function buildRegExps(tokens: readonly string[]): RegExp[] {
  return tokens.map(
    (t, pos) => new RegExp((pos > 0 || t.length > 3 ? '' : '^') + escapeRegExp(t), 'i')
  )
}
