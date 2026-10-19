// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The up / down arrows in the Videos and Audios lists, with Payload's list hooks stood in for. */
const ui = vi.hoisted(() => ({
  state: {
    canUpdate: true,
    sort: '-_order' as string,
    docs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as Array<{ id: string }>,
    hasPrevPage: false,
    hasNextPage: false,
  },
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: ui.refresh }) }))
vi.mock('@payloadcms/ui', () => ({
  toast: { error: ui.toastError, info: ui.toastInfo },
  useConfig: () => ({ config: { routes: { api: '/api' } } }),
  useAuth: () => ({
    permissions: { collections: { videos: { update: ui.state.canUpdate } } },
  }),
  useListQuery: () => ({
    data: {
      docs: ui.state.docs,
      hasPrevPage: ui.state.hasPrevPage,
      hasNextPage: ui.state.hasNextPage,
    },
    query: { sort: ui.state.sort },
  }),
}))

const { MoveArrows } = await import('@/payload/admin/media/MoveArrows')

let root: Root
let host: HTMLElement
const fetchMock = vi.fn()

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Object.assign(ui.state, {
    canUpdate: true,
    sort: '-_order',
    docs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    hasPrevPage: false,
    hasNextPage: false,
  })
  ui.refresh.mockReset()
  ui.toastError.mockReset()
  ui.toastInfo.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const render = (row: { id: string; _order?: string | null } = { id: 'b', _order: 'a1' }) =>
  act(() =>
    root.render(createElement(MoveArrows, { collectionSlug: 'videos', rowData: row } as never)),
  )
const button = (name: 'Move up' | 'Move down') =>
  host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!
const press = async (name: 'Move up' | 'Move down') => {
  await act(async () => {
    button(name).click()
  })
}
const requestUrl = (n: number) => new URL(String(fetchMock.mock.calls[n]![0]), 'https://x.test')
const requestBody = (n: number) => JSON.parse(String(fetchMock.mock.calls[n]![1].body))

describe('Move up / Move down', () => {
  it('up (list sorted by position, top first): goes above the entry with the next greater key', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ docs: [{ id: 'a', _order: 'a2' }] }))
      .mockResolvedValueOnce(json({ success: true }))
    render()
    await press('Move up')
    const lookup = requestUrl(0)
    expect(lookup.pathname).toBe('/api/videos')
    expect(lookup.searchParams.get('sort')).toBe('_order')
    expect(lookup.searchParams.get('where[_order][greater_than]')).toBe('a1')
    expect(lookup.searchParams.get('limit')).toBe('1')
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/reorder')
    expect(requestBody(1)).toEqual({
      collectionSlug: 'videos',
      docsToMove: ['b'],
      newKeyWillBe: 'greater',
      orderableFieldName: '_order',
      target: { id: 'a', key: 'a2' },
    })
    expect(ui.refresh).toHaveBeenCalledTimes(1)
  })

  it('down: goes below the entry with the next smaller key', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ docs: [{ id: 'c', _order: 'a0' }] }))
      .mockResolvedValueOnce(json({ success: true }))
    render()
    await press('Move down')
    const lookup = requestUrl(0)
    expect(lookup.searchParams.get('sort')).toBe('-_order')
    expect(lookup.searchParams.get('where[_order][less_than]')).toBe('a1')
    expect(requestBody(1)).toMatchObject({ newKeyWillBe: 'less', target: { id: 'c', key: 'a0' } })
  })

  it('follows the list when it is sorted the other way (ascending)', async () => {
    ui.state.sort = '_order'
    fetchMock
      .mockResolvedValueOnce(json({ docs: [{ id: 'a', _order: 'a0' }] }))
      .mockResolvedValueOnce(json({ success: true }))
    render()
    await press('Move up')
    expect(requestUrl(0).searchParams.get('where[_order][less_than]')).toBe('a1')
    expect(requestBody(1)).toMatchObject({ newKeyWillBe: 'less' })
  })

  it('cannot go past the first or last row of the list', () => {
    render({ id: 'a', _order: 'a2' })
    expect(button('Move up').disabled).toBe(true)
    expect(button('Move down').disabled).toBe(false)
    render({ id: 'c', _order: 'a0' })
    expect(button('Move up').disabled).toBe(false)
    expect(button('Move down').disabled).toBe(true)
  })

  it('can still move across a page boundary', () => {
    ui.state.hasPrevPage = true
    ui.state.hasNextPage = true
    render({ id: 'a', _order: 'a2' })
    expect(button('Move up').disabled).toBe(false)
    render({ id: 'c', _order: 'a0' })
    expect(button('Move down').disabled).toBe(false)
  })

  it('says so when there is nothing above or below, and changes nothing', async () => {
    ui.state.sort = 'createdAt'
    fetchMock.mockResolvedValueOnce(json({ docs: [] }))
    render()
    await press('Move up')
    expect(ui.toastInfo).toHaveBeenCalledWith('It is already at the top.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(ui.refresh).not.toHaveBeenCalled()
  })

  it('reports a refused move and leaves the list as it is', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ docs: [{ id: 'a', _order: 'a2' }] }))
      .mockResolvedValueOnce(json({}, 403))
    render()
    await press('Move up')
    expect(ui.toastError).toHaveBeenCalledWith('You do not have permission to reorder these.')
    expect(ui.refresh).not.toHaveBeenCalled()
    expect(button('Move up').disabled).toBe(false)
  })

  it('asks for a first drag when the entry has no position yet', async () => {
    render({ id: 'b', _order: null })
    await press('Move up')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(ui.toastError).toHaveBeenCalledTimes(1)
  })

  it('shows nothing to someone who cannot edit', () => {
    ui.state.canUpdate = false
    render()
    expect(host.querySelector('button')).toBeNull()
  })
})
