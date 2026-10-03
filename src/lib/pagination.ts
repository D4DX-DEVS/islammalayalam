/** Window of page numbers around the current page, with first/last and gaps. */
export function pageWindow(page: number, total: number): Array<number | 'gap'> {
  const keep = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total))
  const out: Array<number | 'gap'> = []
  let prev = 0
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (n - prev > 1) out.push('gap')
    out.push(n)
    prev = n
  }
  return out
}
