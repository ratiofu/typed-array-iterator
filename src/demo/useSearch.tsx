import type { ReactNode } from 'react'
import type { FixtureModel } from '../fixtures/FixtureModel'
import { tokenize } from '../lib/tokenize'
import { type Stream, stream } from '../Stream'
import { manualSearch } from './manualSearch'
import { ResultList } from './ResultList'
import { timedValue } from './timedValue'

function streamSearch(data: readonly FixtureModel[], query: string): Stream<FixtureModel> {
  return stream<FixtureModel>(data).filterText(query, 'name', 'emailAddress')
}

export type SearchStats = Readonly<{
  totalItems: number
  shownItemsCount: number
}>

type SearchResult = SearchStats &
  Readonly<{
    durationMs: number
    listComponent: ReactNode
  }>

type RenderResult = Omit<SearchResult, 'durationMs'>

type UseSearchReturn = Readonly<{
  stream: SearchResult
  manual: SearchResult
}>

function renderList(
  items: readonly FixtureModel[] | Stream<FixtureModel>,
  tokens: readonly string[]
): RenderResult {
  const totalItems = items.length
  const shownItems = items.slice(0, 100)
  const shownItemsCount = shownItems.length
  return {
    listComponent: <ResultList shownItems={shownItems} tokens={tokens} />,
    shownItemsCount,
    totalItems,
  }
}

export function useSearch(data: readonly FixtureModel[], query: string): UseSearchReturn {
  const tokens = tokenize(query)
  const resultsStream = timedValue(() => {
    const items = streamSearch(data, query).toArray()
    return renderList(items, tokens)
  })
  const resultsManual = timedValue(() => {
    const items = manualSearch(data, query)
    return renderList(items, tokens)
  })

  return {
    stream: {
      ...resultsStream.value,
      durationMs: resultsStream.millis,
    },
    manual: {
      ...resultsManual.value,
      durationMs: resultsManual.millis,
    },
  }
}
