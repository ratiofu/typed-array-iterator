import type { FixtureModel } from '../fixtures/FixtureModel'
import { buildRegExps } from '../lib/buildRegExps'
import { notSpecificEnough } from '../lib/notSpecificEnough'
import { tokenize } from '../lib/tokenize'

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this is purposely complex
export function manualSearch(data: readonly FixtureModel[], query: string): FixtureModel[] {
  const tokens = tokenize(query)
  if (notSpecificEnough(tokens)) return []
  tokens.sort((a, b) => b.length - a.length)
  const regexes = buildRegExps(tokens)
  const out: FixtureModel[] = []

  for (let i = 0; i < data.length; i++) {
    const u = data[i]
    if (!u) continue
    const v1u = u.name
    const v2u = u.emailAddress
    const v1 = typeof v1u === 'string' ? v1u : ''
    const v2 = typeof v2u === 'string' ? v2u : ''
    let ok = true
    for (let r = 0; r < regexes.length; r++) {
      const re = regexes[r]
      if (!re) continue
      if (!(re.test(v1) || re.test(v2))) {
        ok = false
        break
      }
    }
    if (ok) out.push(u)
  }
  return out
}
