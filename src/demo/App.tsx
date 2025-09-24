import { useId, useMemo, useState } from 'react'
import { byNameSorter } from '../fixtures/FixtureModel'
import { generateFixtureData } from '../fixtures/generateFixtureData'
import { ResultsColumn } from './ResultsColumn'
import { timedValue } from './timedValue'
import { usePersistedValue } from './usePersistedValue'
import { useSearch } from './useSearch'

export function App() {
  const [fixtureSize, setFixtureSize] = usePersistedValue('fixtureSize', 100_000, Number)
  const [query, setQuery] = useState('')
  const { data, generateMs, sortMs } = useMemo(() => {
    const { value: data, millis: generateMs } = timedValue(() => generateFixtureData(fixtureSize))
    const { value: sorted, millis: sortMs } = timedValue(() => data.sort(byNameSorter))
    return { data: sorted, generateMs, sortMs }
  }, [fixtureSize])
  const search = useSearch(data, query)

  return (
    <div className="app">
      <main className="main">
        <h1>Stream Text Search Demo</h1>
        <p>
          <input
            id={useId()}
            min={100}
            max={500_000}
            type="number"
            className="inline-input"
            value={fixtureSize}
            onChange={(event) =>
              setFixtureSize(parseInt((event.target as HTMLInputElement).value, 10) || 100_000)
            }
          />
          dummy data records created in <strong>{generateMs.toLocaleString()}</strong> ms and sorted
          in <strong>{sortMs.toLocaleString()}</strong> ms.
        </p>
        <label className="label" htmlFor="q">
          Search users by typing one or more terms
        </label>
        <input
          id={useId()}
          className="input"
          placeholder="e.g. ali exam"
          value={query}
          onChange={(event) => setQuery((event.target as HTMLInputElement).value)}
        />
        <h2>Search Results</h2>
        <div className="row">
          <ResultsColumn title="Stream (compiled)" {...search.stream}>
            {search.stream.listComponent}
          </ResultsColumn>
          <ResultsColumn title="Manual (arrays)" {...search.manual}>
            {search.manual.listComponent}
          </ResultsColumn>
        </div>
      </main>

      <aside className="side">
        <div className="h1">About</div>
        <div className="help">
          <p>
            This demo compares the compiled stream.filterText implementation with a manual
            arrays-based search, on a dataset of 200,000 in-memory records. Results show duration
            and the first 20 matches (sorted by name).
          </p>
          <p>
            Short tokens (length &lt; 4) use starts-with ("^") matching; longer tokens use
            case-insensitive contains. Both name and emailAddress are searched.
          </p>
        </div>
      </aside>
    </div>
  )
}
