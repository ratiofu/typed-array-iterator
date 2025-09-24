import type { PropsWithChildren } from 'react'

type ColumnProps = PropsWithChildren<Readonly<{ title: string; durationMs: number }>>

export function ResultsColumn({ title, durationMs, children }: ColumnProps) {
  return (
    <div className="card">
      <div className="card-hd">
        <div className="card-ttl">{title}</div>
        <div className="meta">{durationMs.toFixed(2)} ms</div>
      </div>
      {children}
    </div>
  )
}
