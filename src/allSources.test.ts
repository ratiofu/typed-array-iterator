import { expect, test } from 'bun:test'

// Include all .ts and .tsx source files in coverage, even if not directly used in tests.
// Excludes test files and browser/server entrypoints with side effects.
const EXCLUDES: RegExp[] = [
  /\/node_modules\//i,
  /\/dist\//i,
  /\.(spec|test)\.(ts|tsx)$/i,
  /\/demo\/index\.ts$/i, // starts a Bun HTTP server
  // /\/demo\/frontend\.tsx$/i, // touches DOM on import
]

function shouldInclude(path: string): boolean {
  return !EXCLUDES.some((rx) => rx.test(path))
}

test('include all TS/TSX sources for coverage', async () => {
  const rootDir = new URL('..', import.meta.url).pathname // repo root
  const glob = new globalThis.Bun.Glob('src/**/*.{ts,tsx}')
  const imported: string[] = []
  for await (const file of glob.scan(rootDir)) {
    if (!shouldInclude(file)) continue
    // Resolve from this test file's URL
    const url = new URL(`../${file}`, import.meta.url)
    await import(url.href)
    imported.push(file)
  }
  // Sanity: we should have imported at least the main module
  expect(imported.some((p) => p.endsWith('src/Stream.ts'))).toBe(true)
})
