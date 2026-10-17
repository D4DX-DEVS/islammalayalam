import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WhatsAppButton } from '@/components/layout/WhatsAppButton'

const html = renderToStaticMarkup(
  createElement(WhatsAppButton, { href: 'https://wa.me/919876543210?text=Hi' }),
)

describe('WhatsAppButton', () => {
  it('opens the chat in a new tab, safely', () => {
    expect(html).toContain('href="https://wa.me/919876543210?text=Hi"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('is named for screen readers by its aria-label, not by the text that slides out', () => {
    expect(html).toContain('aria-label="Ask a Question on WhatsApp"')
    expect(html).toMatch(/aria-hidden="true"[^>]*>Ask a Question</)
  })

  it('is only the icon at rest: the label has no width and is see-through until hover or focus', () => {
    const label = /<span class="([^"]*)" aria-hidden="true">Ask a Question<\/span>/.exec(html)![1]!
    expect(label).toContain('max-w-0')
    expect(label).toContain('opacity-0')
    for (const state of ['group-hover', 'group-focus-visible']) {
      expect(label).toContain(`${state}:max-w-[12rem]`)
      expect(label).toContain(`${state}:opacity-100`)
    }
    expect(label).toContain('motion-reduce:transition-none')
  })

  it('draws the WhatsApp icon, and stops the pulse while it is open', () => {
    expect(html).toContain('<svg')
    expect(html).toContain('size-7')
    expect(html).toContain('group-hover:hidden')
    expect(html).toContain('group-focus-visible:hidden')
  })

  it('sits in the bottom corner, clear of the back-to-top button', () => {
    expect(html).toContain('fixed bottom-4 end-4')
    expect(html).toContain('h-14')
  })
})
