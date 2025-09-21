import type { Op } from '../types'

import { buildOpsUnrolled } from './shared'

export function compileReduce(
  isArrayLikeSource: boolean,
  ops: readonly Op[],
  reducer: (accumulator: unknown, value: unknown, index: number) => unknown,
  hasInitial: boolean,
  initialValue: unknown
): (source: Iterable<unknown> | ArrayLike<unknown>) => unknown {
  const { argNames, argValues, lines } = buildOpsUnrolled(ops)

  if (isArrayLikeSource) {
    const srcArgs = ['data', 'reducer', 'hasInitial', 'initialValue', ...argNames]
    const body = [
      'const dataLength = data.length',
      'let logicalIndex = 0',
      'let emittedIndex = 0',
      'let started = hasInitial',
      'let accumulator = initialValue',
      'for (let i = 0; i < dataLength; i++) {',
      '  let currentValue = data[i]',
      '  const index = logicalIndex++',
      ...lines.map((l) => `  ${l}`),
      '  if (started) {',
      '    accumulator = reducer(accumulator, currentValue, emittedIndex++)',
      '  } else {',
      '    accumulator = currentValue',
      '    started = true',
      '    emittedIndex++',
      '  }',
      '}',
      'if (!started) { throw new TypeError("Reduce of empty stream with no initial value") }',
      'return accumulator',
    ].join('\n')
    // eslint-disable-next-line no-new-func
    const fn = new Function(...srcArgs, body) as (
      data: ArrayLike<unknown>,
      reducer: (a: unknown, v: unknown, i: number) => unknown,
      hasInitial: boolean,
      initialValue: unknown,
      ...fns: Function[]
    ) => unknown
    return (source) =>
      fn(source as ArrayLike<unknown>, reducer, hasInitial, initialValue, ...argValues)
  }

  const srcArgs = ['iterable', 'reducer', 'hasInitial', 'initialValue', ...argNames]
  const body = [
    'let logicalIndex = 0',
    'let emittedIndex = 0',
    'let started = hasInitial',
    'let accumulator = initialValue',
    'for (const currentValueRaw of iterable) {',
    '  let currentValue = currentValueRaw',
    '  const index = logicalIndex++',
    ...lines.map((l) => `  ${l}`),
    '  if (started) {',
    '    accumulator = reducer(accumulator, currentValue, emittedIndex++)',
    '  } else {',
    '    accumulator = currentValue',
    '    started = true',
    '    emittedIndex++',
    '  }',
    '}',
    'if (!started) { throw new TypeError("Reduce of empty stream with no initial value") }',
    'return accumulator',
  ].join('\n')
  // eslint-disable-next-line no-new-func
  const fn = new Function(...srcArgs, body) as (
    iterable: Iterable<unknown>,
    reducer: (a: unknown, v: unknown, i: number) => unknown,
    hasInitial: boolean,
    initialValue: unknown,
    ...fns: Function[]
  ) => unknown
  return (source) =>
    fn(source as Iterable<unknown>, reducer, hasInitial, initialValue, ...argValues)
}
