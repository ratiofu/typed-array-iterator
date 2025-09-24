import type { ReactNode } from 'react'
import type { FixtureModel } from '../fixtures/FixtureModel'
import type { Stream } from '../Stream'

type ItemsProps = Readonly<{
  items: readonly FixtureModel[] | Stream<FixtureModel>
  tokens: readonly string[]
}>

export function ResultList({ items, tokens }: ItemsProps) {
  const totalItems = items.length
  const shownItems = items.slice(0, 500)
  const shownItemsCount = shownItems.length
  const more = Math.max(0, totalItems - shownItemsCount)
  return (
    <div className="card-body">
      <ul className="list">
        {shownItems.map((u) => (
          <li key={u.id}>
            <HighlightedText tokens={tokens}>
              {u.name}
              {u.emailAddress ? ` <${u.emailAddress}>` : ''}
            </HighlightedText>
          </li>
        ))}
      </ul>
      <div className="more">{more > 0 ? `${more.toLocaleString()} more results` : '\u00a0'} </div>
    </div>
  )
}

type Props = { tokens: readonly string[]; children: string | readonly string[] }

function HighlightedText({ tokens, children }: Props) {
  const result: ReactNode[] = []
  const text: string = Array.isArray(children) ? children.join('') : children.toString()
  let pos = 0
  for (const token of tokens) {
    const lowerToken = token.toLowerCase()
    const lowerText = text.toLowerCase()
    let start = lowerText.indexOf(lowerToken, pos)
    while (start >= 0) {
      result.push(text.slice(pos, start))
      result.push(<mark key={result.length}>{text.slice(start, start + token.length)}</mark>)
      pos = start + token.length
      start = lowerText.indexOf(lowerToken, pos)
    }
  }
  result.push(text.slice(pos))
  return result
}
