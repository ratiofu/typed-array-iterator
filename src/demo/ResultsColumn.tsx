import type { PropsWithChildren } from 'react'
import type { SearchStats } from './useSearch'

type ColumnProps = SearchStats & PropsWithChildren<Readonly<{ title: string; durationMs: number }>>

export function ResultsColumn({
  title,
  durationMs,
  children,
  totalItems,
  shownItemsCount,
}: ColumnProps) {
  return (
    <div className="card">
      <div className="card-hd card-content">
        <div className="card-ttl">{title}</div>
        <div className="meta">{durationMs.toFixed(2)} ms</div>
      </div>
      {children}
      <div className="card-ft card-content">
        Showing {shownItemsCount.toLocaleString()}
        {totalItems > shownItemsCount ? ` of ${totalItems.toLocaleString()}` : ''}
      </div>
    </div>
  )
}
