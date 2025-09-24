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

type SearchResult = Readonly<{
  durationMs: number
  listComponent: ReactNode
}>

type UseSearchReturn = Readonly<{
  stream: SearchResult
  manual: SearchResult
}>

export function useSearch(data: readonly FixtureModel[], query: string): UseSearchReturn {
  const tokens = tokenize(query)
  const resultsStream = timedValue(() => {
    const items = streamSearch(data, query)
    return <ResultList items={items} tokens={tokens} />
  })
  const resultsManual = timedValue(() => {
    const items = manualSearch(data, query)
    return <ResultList items={items} tokens={tokens} />
  })

  return {
    stream: {
      durationMs: resultsStream.millis,
      listComponent: resultsStream.value,
      // durationMs: -1,
      // listComponent: <></>,
    },
    manual: {
      durationMs: resultsManual.millis,
      listComponent: resultsManual.value,
    },
  }
}
