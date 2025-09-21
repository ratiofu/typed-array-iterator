import type { Op } from '../types'
import { buildOpsUnrolled } from './shared'

export function compileToArray(
  isArrayLikeSource: boolean,
  ops: readonly Op[]
): (source: Iterable<unknown> | ArrayLike<unknown>) => unknown[] {
  const { argNames, argValues, lines } = buildOpsUnrolled(ops)

  if (isArrayLikeSource) {
    const srcArgs = ['data', ...argNames]
    const body = [
      'const result = []',
      'const dataLength = data.length',
      'let logicalIndex = 0',
      'let emittedIndex = 0',
      'for (let i = 0; i < dataLength; i++) {',
      '  let currentValue = data[i]',
      '  const index = logicalIndex++',
      ...lines.map((l) => `  ${l}`),
      '  result.push(currentValue)',
      '  emittedIndex++',
      '}',
      'return result',
    ].join('\n')
    // eslint-disable-next-line no-new-func
    const fn = new Function(...srcArgs, body) as (
      data: ArrayLike<unknown>,
      ...fns: Function[]
    ) => unknown[]
    return (source) => fn(source as ArrayLike<unknown>, ...argValues)
  }

  const srcArgs = ['iterable', ...argNames]
  const body = [
    'const result = []',
    'let logicalIndex = 0',
    'let emittedIndex = 0',
    'for (const currentValueRaw of iterable) {',
    '  let currentValue = currentValueRaw',
    '  const index = logicalIndex++',
    ...lines.map((l) => `  ${l}`),
    '  result.push(currentValue)',
    '  emittedIndex++',
    '}',
    'return result',
  ].join('\n')
  // eslint-disable-next-line no-new-func
  const fn = new Function(...srcArgs, body) as (
    iterable: Iterable<unknown>,
    ...fns: Function[]
  ) => unknown[]
  return (source) => fn(source as Iterable<unknown>, ...argValues)
}
