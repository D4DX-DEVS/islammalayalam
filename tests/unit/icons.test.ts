import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Lightbulb } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', async () => {
  const { createElement: h } = await import('react')
  return {
    default: (p: {
      href: string
      children?: unknown
      className?: string
      target?: string
      rel?: string
    }) =>
      h(
        'a',
        { href: p.href, className: p.className, target: p.target, rel: p.rel },
        p.children as string,
      ),
  }
})

const { SocialIcon } = await import('@/components/layout/SocialLinks')
const { SectionHeading } = await import('@/components/ui/SectionHeading')

const NETWORKS = [
  'facebook',
  'x',
  'instagram',
  'youtube',
  'whatsapp',
  'telegram',
  'spotify',
] as const

describe('SocialIcon', () => {
  it.each(NETWORKS)(
    'draws %s as a 2px line icon on the 24px grid, hidden from screen readers',
    (network) => {
      const html = renderToStaticMarkup(createElement(SocialIcon, { network, className: 'size-5' }))
      expect(html).toContain('viewBox="0 0 24 24"')
      expect(html).toContain('stroke="currentColor"')
      expect(html).toContain('stroke-width="2"')
      expect(html).toContain('fill="none"')
      expect(html).toContain('aria-hidden="true"')
      expect(html).toContain('class="size-5"')
      expect(html.match(/<path /g)!.length).toBeGreaterThanOrEqual(1)
    },
  )

  it('draws each network differently', () => {
    const shapes = NETWORKS.map((network) =>
      renderToStaticMarkup(createElement(SocialIcon, { network, className: '' })),
    )
    expect(new Set(shapes).size).toBe(NETWORKS.length)
  })
})

describe('SectionHeading icon badge', () => {
  const render = (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(createElement(SectionHeading, { title: 'Videos', ...props }))

  it('shows a badge with the icon it is given, and no gold bar', () => {
    const html = render({ icon: Lightbulb })
    expect(html).toContain('title-icon')
    expect(html).toContain('lucide-lightbulb')
    expect(html).not.toContain('title-bar')
    expect(html).toContain('>Videos<')
  })

  it('falls back to the news icon rather than an empty badge', () => {
    expect(render()).toContain('lucide-newspaper')
  })

  it('is blue by default, red when asked, and gold on the dark band', () => {
    expect(render()).toContain('to-brand-strong')
    expect(render({ tint: 'red' })).toContain('#c8102e')
    expect(render({ tone: 'dark' })).toContain('#f0a400')
    // the dark band is always gold, whatever tint was asked for
    expect(render({ tone: 'dark', tint: 'red' })).not.toContain('#c8102e')
  })

  it('keeps the "more" link and any actions beside it', () => {
    const html = render({
      href: '/videos/',
      moreLabel: 'View all',
      actions: createElement('i', { id: 'extra' }),
    })
    expect(html).toContain('href="/videos/"')
    expect(html).toContain('View all')
    expect(html).toContain('id="extra"')
  })

  it('opens an external "more" link in a new tab', () => {
    const html = render({ href: 'https://www.youtube.com/@x/shorts', external: true })
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
