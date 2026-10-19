import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * <ScrollReveal> adds attributes to elements marked `data-reveal` after the page has loaded. A
 * section that streams in later and hydrates after that would report a hydration mismatch, so
 * every such element must carry `suppressHydrationWarning` (see components/ui/ScrollReveal.tsx).
 */
const ROOT = path.resolve(__dirname, '../../src')

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? tsxFiles(full) : full.endsWith('.tsx') ? [full] : []
  })
}

describe('scroll-reveal elements', () => {
  it('always carry suppressHydrationWarning', () => {
    const missing: string[] = []
    for (const file of tsxFiles(ROOT)) {
      if (file.endsWith('ScrollReveal.tsx')) continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(
        /data-reveal=(?:"[^"]*"|\{[^}]*\})(?!\s*suppressHydrationWarning)/g,
      )) {
        const line = source.slice(0, match.index).split('\n').length
        missing.push(`${path.relative(ROOT, file)}:${line}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('is actually looking at files (guards against the scan silently finding nothing)', () => {
    const withReveal = tsxFiles(ROOT).filter((f) =>
      readFileSync(f, 'utf8').includes('data-reveal='),
    )
    expect(withReveal.length).toBeGreaterThan(5)
  })
})
