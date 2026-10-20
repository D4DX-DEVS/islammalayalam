/**
 * Moves the block with `id` one place up (`-1`) or down (`+1`) in a list of homepage blocks.
 * Returns the new list, or null when the block is not in the list or is already at that end.
 */
export function moveBlock<T extends { id?: string | null }>(
  list: readonly T[],
  id: string,
  delta: -1 | 1,
): T[] | null {
  const from = list.findIndex((block) => block.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= list.length) return null
  const next = [...list]
  ;[next[from], next[to]] = [next[to]!, next[from]!]
  return next
}
