export const FILTER_TEXT_HINTS: unique symbol = Symbol.for('stream.filterTextHints')

export type FilterTextHints = {
  query: string
  tokens: readonly string[]
  regexes: readonly RegExp[]
  fields: readonly string[]
}
