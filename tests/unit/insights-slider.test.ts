// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The Insights poster slider: one poster at a time, arrows, dots, and share options that follow. */
vi.mock('next/link', async () => {
  const { createElement: h } = await import('react')
  return {
    default: (p: { href: string; children?: unknown }) =>
      h('a', { href: p.href }, p.children as string),
  }
})
vi.mock('@/components/quotes/QuoteShare', async () => {
  const { createElement: h } = await import('react')
  return {
    QuoteShare: (p: { url: string; text: string; posterSrc?: string | null }) =>
      h('div', { 'data-share': '', 'data-url': p.url, 'data-text': p.text }),
  }
})

const { InsightsSlider } = await import('@/components/quotes/InsightsSlider')

const slide = (n: number) => ({
  key: `q${n}`,
  href: `/quote/q${n}/`,
  poster: createElement('span', null, `poster ${n}`),
  share: { url: `https://site.test/quote/q${n}/`, text: `text ${n}`, posterSrc: null },
})

let root: Root
let host: HTMLElement

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const render = (count: number) =>
  act(() =>
    root.render(
      createElement(InsightsSlider, {
        slides: Array.from({ length: count }, (_, i) => slide(i + 1)),
        label: 'Insights',
        title: 'Insights',
        href: '/insights/',
      }),
    ),
  )
const click = (label: string) =>
  act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click())
const shownSlide = () =>
  [...host.querySelectorAll('[aria-roledescription="slide"]')].findIndex(
    (s) => !s.hasAttribute('inert'),
  )
const shared = () => host.querySelector('[data-share]')!.getAttribute('data-url')
const track = () =>
  host.querySelector<HTMLElement>('[aria-roledescription="slide"]')!.parentElement!

describe('InsightsSlider', () => {
  it('shows the first poster, and its share options', () => {
    render(4)
    expect(shownSlide()).toBe(0)
    expect(shared()).toBe('https://site.test/quote/q1/')
    expect(track().style.transform).toBe('translateX(-0%)')
    expect(host.querySelectorAll('[aria-roledescription="slide"]')).toHaveLength(4)
  })

  it('moves one poster at a time with the arrows, the share options following', async () => {
    render(4)
    await click('Next insight')
    expect(shownSlide()).toBe(1)
    expect(track().style.transform).toBe('translateX(-100%)')
    expect(shared()).toBe('https://site.test/quote/q2/')
    await click('Previous insight')
    expect(shownSlide()).toBe(0)
  })

  it('wraps around at both ends', async () => {
    render(4)
    await click('Previous insight')
    expect(shownSlide()).toBe(3)
    await click('Next insight')
    expect(shownSlide()).toBe(0)
  })

  it('jumps with the dots, and marks the one in view', async () => {
    render(4)
    await click('3 / 4')
    expect(shownSlide()).toBe(2)
    const selected = [...host.querySelectorAll('[role=tab]')].map((t) =>
      t.getAttribute('aria-selected'),
    )
    expect(selected).toEqual(['false', 'false', 'true', 'false'])
  })

  it('keeps every poster but the one in view out of reach', () => {
    render(4)
    expect(host.querySelectorAll('[aria-roledescription="slide"][inert]')).toHaveLength(3)
  })

  it('links each poster to its own page', () => {
    render(2)
    const links = [...host.querySelectorAll('a[href^="/quote/"]')].map((a) =>
      a.getAttribute('href'),
    )
    expect(links).toEqual(['/quote/q1/', '/quote/q2/'])
  })

  it('has no arrows or dots for a single poster, and nothing for none', () => {
    render(1)
    expect(host.querySelector('button')).toBeNull()
    expect(shared()).toBe('https://site.test/quote/q1/')
    render(0)
    expect(host.textContent).toBe('')
  })
})
