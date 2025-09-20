import { arrayBaseIterator } from './arrayBaseIterator'
import { arrayIteratorFor } from './arrayIteratorFor'
import { flattenIterator } from './flattenIterator'
import { iterableBaseIterator } from './iterableBaseIterator'
import { mapFilterIterator } from './mapFilterIterator'
import { splitIntoSegments } from './splitIntoSegments'
import { asArrayLikeOrNull, type Op } from './types'
import { wrapAsIterableIterator } from './wrapAsIterableIterator'

export function createFusedIterator<T>(
  source: Iterable<unknown>,
  operations: readonly Op[]
): IterableIterator<T> {
  // Split ops into segments separated by 'flatten'
  const segments = splitIntoSegments(operations)
  const hasFlatten = segments.length > 1

  // If no flatten, keep the array fast path
  const arrayLike = asArrayLikeOrNull(source)
  if (!hasFlatten && arrayLike) {
    return arrayIteratorFor(arrayLike, segments[0] ?? [])
  }

  // Build a generic iterator pipeline
  let iter: Iterator<unknown> = arrayLike
    ? arrayBaseIterator(arrayLike)
    : iterableBaseIterator(source)

  for (let s = 0; s < segments.length; s++) {
    iter = mapFilterIterator(iter, segments[s] ?? [])
    if (s < segments.length - 1) {
      iter = flattenIterator(iter)
    }
  }

  return wrapAsIterableIterator<T>(iter)
}
