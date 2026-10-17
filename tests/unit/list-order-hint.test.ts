// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The note above the Audios / Videos lists: opens them in position order so dragging works. */
const ui = vi.hoisted(() => ({
  state: { sort: undefined as string | undefined, slug: 'videos' },
  handleSortChange: vi.fn(),
}))

vi.mock('next/link', async () => {
  const { createElement: h } = await import('react')
  return {
    default: (p: { href: string; className?: string; children?: unknown }) =>
      h('a', { href: p.href, className: p.className }, p.children as string),
  }
})
vi.mock('@payloadcms/ui', () => ({
  useConfig: () => ({ config: { routes: { admin: '/admin' } } }),
  useListQuery: () => ({
    collectionSlug: ui.state.slug,
    handleSortChange: ui.handleSortChange,
    orderableFieldName: '_order',
    query: { sort: ui.state.sort },
  }),
}))

const { ListOrderHint } = await import('@/payload/admin/media/ListOrderHint')

let root: Root
let host: HTMLElement

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ui.state.sort = undefined
  ui.state.slug = 'videos'
  ui.handleSortChange.mockReset()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

const render = () => act(() => root.render(createElement(ListOrderHint)))
const settle = () => act(() => void vi.advanceTimersByTime(300))
const button = () => host.querySelector('button')
const add = () => host.querySelector<HTMLAnchorElement>('a.im-order-hint__add')

describe('ListOrderHint', () => {
  it.each([undefined, 'createdAt', '-createdAt', 'author'])(
    'opens a list sorted by %s in position order, once',
    async (sort) => {
      ui.state.sort = sort
      render()
      await settle()
      expect(ui.handleSortChange).toHaveBeenCalledTimes(1)
      expect(ui.handleSortChange).toHaveBeenCalledWith('-_order')
    },
  )

  it.each(['-_order', '_order'])(
    'leaves a list already sorted by position (%s) alone',
    async (sort) => {
      ui.state.sort = sort
      render()
      await settle()
      expect(ui.handleSortChange).not.toHaveBeenCalled()
      expect(button()).toBeNull()
    },
  )

  it('does not fight a sort chosen afterwards, but offers the way back', async () => {
    ui.state.sort = '-_order'
    render()
    await settle()
    ui.state.sort = 'createdAt' // the person clicked another column
    render()
    await settle()
    expect(ui.handleSortChange).not.toHaveBeenCalled()
    expect(button()?.textContent).toBe('Sort by position')
    await act(async () => button()!.click())
    expect(ui.handleSortChange).toHaveBeenCalledWith('-_order')
  })

  it('explains how to reorder', () => {
    ui.state.sort = '-_order'
    render()
    expect(host.textContent).toContain('Drag a row by its handle')
    expect(host.textContent).toContain('top row is shown first on the site')
  })

  it.each([
    ['videos', 'Add new video'],
    ['audios', 'Add new audio'],
    ['quotes', 'Add new poster'],
  ])('offers "%s" an add button to the new-entry form', (slug, label) => {
    ui.state.slug = slug
    ui.state.sort = '-_order'
    render()
    expect(add()?.textContent).toBe(label)
    expect(add()?.getAttribute('href')).toBe(`/admin/collections/${slug}/create`)
  })
})
