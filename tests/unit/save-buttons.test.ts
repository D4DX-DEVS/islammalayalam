// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The Audio / Video editor's "Add" button, with Payload's form hooks stood in for. */
const ui = vi.hoisted(() => ({
  state: {
    slug: 'videos',
    id: undefined as string | undefined,
    modified: true,
    data: {} as Record<string, unknown>,
    result: { res: { status: 200 } } as { res?: { status: number } } | undefined,
  },
  submit: vi.fn(),
  setModified: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@payloadcms/ui', async () => {
  const { createElement: h } = await import('react')
  return {
    SaveButton: () => h('button', { id: 'save' }, 'Save'),
    Button: (p: {
      id?: string
      el?: string
      to?: string
      disabled?: boolean
      onClick?: () => void
      children?: unknown
    }) =>
      p.el === 'link'
        ? h('a', { id: p.id, href: p.to }, p.children as string)
        : h('button', { id: p.id, disabled: p.disabled, onClick: p.onClick }, p.children as string),
    toast: { error: ui.toastError },
    useConfig: () => ({ config: { routes: { admin: '/admin' } } }),
    useDocumentInfo: () => ({ collectionSlug: ui.state.slug, id: ui.state.id }),
    useForm: () => ({
      getData: () => ui.state.data,
      setModified: ui.setModified,
      submit: ui.submit,
    }),
    useFormModified: () => ui.state.modified,
  }
})

const { SaveButtons } = await import('@/payload/admin/media/SaveButtons')

let root: Root
let host: HTMLElement
const assign = vi.fn()

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Object.assign(ui.state, {
    slug: 'videos',
    id: undefined,
    modified: true,
    data: {},
    result: { res: { status: 200 } },
  })
  ui.submit.mockReset().mockImplementation(async () => ui.state.result)
  ui.setModified.mockReset()
  ui.toastError.mockReset()
  assign.mockReset()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'https://admin.example', assign },
  })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const render = () => act(() => root.render(createElement(SaveButtons)))
const addButton = () => host.querySelector<HTMLButtonElement>('#action-add-another')!
const click = async () => {
  await act(async () => {
    addButton().click()
  })
}

describe('Audio / Video "Add" button', () => {
  it('sits beside Save and is named for the collection', () => {
    render()
    expect(host.querySelector('#save')?.textContent).toBe('Save')
    expect(addButton().textContent).toBe('Add Video')
    ui.state.slug = 'audios'
    render()
    expect(addButton().textContent).toBe('Add Audio')
  })

  it('saves, then opens a blank form for the next one', async () => {
    ui.state.data = { title: 'A talk' }
    render()
    await click()
    expect(ui.submit).toHaveBeenCalledTimes(1)
    expect(ui.setModified).toHaveBeenCalledWith(false)
    expect(assign).toHaveBeenCalledTimes(1)
    expect(String(assign.mock.calls[0]![0])).toBe(
      'https://admin.example/admin/collections/videos/create',
    )
  })

  it('does not save an empty new entry', async () => {
    ui.state.data = { link: '  ', title: '', author: '' }
    render()
    await click()
    expect(ui.toastError).toHaveBeenCalledWith('Fill in at least one of link, title or author.')
    expect(ui.submit).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  it('stays on the form when the save is rejected', async () => {
    ui.state.data = { link: 'http://nope.example' }
    ui.state.result = { res: { status: 400 } }
    render()
    await click()
    expect(assign).not.toHaveBeenCalled()
    expect(ui.setModified).not.toHaveBeenCalled()
    expect(addButton().disabled).toBe(false)
  })

  it('stays on the form when the save never completes', async () => {
    ui.state.data = { title: 'x' }
    ui.state.result = undefined
    render()
    await click()
    expect(assign).not.toHaveBeenCalled()
  })

  it('on an existing entry: saves the changes, then opens a blank form', async () => {
    Object.assign(ui.state, { id: '7', modified: true, data: { title: 'Edited' } })
    render()
    expect(addButton().textContent).toBe('Add New')
    await click()
    expect(ui.submit).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('on an unchanged existing entry: just opens the blank form, no save', async () => {
    Object.assign(ui.state, { id: '7', modified: false, data: { title: 'Same' } })
    render()
    await click()
    expect(ui.submit).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledTimes(1)
  })

  it('has a Back button to the list, before Save', () => {
    render()
    const back = host.querySelector<HTMLAnchorElement>('#action-back')!
    expect(back.getAttribute('href')).toBe('/admin/collections/videos')
    expect(back.textContent).toContain('Back')
    const order = [...host.querySelectorAll('#action-back, #save, #action-add-another')].map(
      (el) => el.id,
    )
    expect(order).toEqual(['action-back', 'save', 'action-add-another'])
  })

  describe('in the Insight (poster) editor', () => {
    beforeEach(() => {
      ui.state.slug = 'quotes'
    })

    it('says Add Poster, and goes back to the Insights list', () => {
      render()
      expect(addButton().textContent).toBe('Add Poster')
      expect(host.querySelector('#action-back')!.getAttribute('href')).toBe(
        '/admin/collections/quotes',
      )
    })

    it('does not save an empty insight', async () => {
      ui.state.data = { text: '   ' }
      render()
      await click()
      expect(ui.toastError).toHaveBeenCalledWith('Upload a poster image or write some text first.')
      expect(ui.submit).not.toHaveBeenCalled()
    })

    it.each([
      ['a poster alone', { poster: 'media-1' }],
      ['text alone', { text: 'A thought' }],
    ])('saves with %s, then opens a blank form', async (_, data) => {
      ui.state.data = data
      render()
      await click()
      expect(ui.submit).toHaveBeenCalledTimes(1)
      expect(String(assign.mock.calls[0]![0])).toBe(
        'https://admin.example/admin/collections/quotes/create',
      )
    })
  })
})
