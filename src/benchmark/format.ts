function asK(count: number): string {
  return `${(Math.round(count / 100) / 10).toLocaleString()}k`
}

function asM(value: number): string {
  return `${(Math.round(value / 100_000) / 10).toLocaleString()}M`
}

export function formatNumber(value: number): string {
  return value > 1_000_000 ? asM(value) : value > 1_000 ? asK(value) : value.toLocaleString()
}
