import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import type { PageFlip } from 'page-flip/dist/js/page-flip.module.js'

/**
 * The e-book reader's engine, outside React: pdf.js reads the PDF (worker and data files from our own
 * /pdfjs/, see scripts/copy-pdfjs.mjs) and page-flip turns the pages. Each page is a <div> holding a
 * <canvas>; only the pages around the open spread are drawn, and pages far away are freed again, so
 * a 300-page book costs about as much memory as a 20-page one.
 */
export type BookStatus =
  | { kind: 'loading'; progress: number | null }
  | { kind: 'ready'; page: number; pages: number; portrait: boolean }
  | { kind: 'error' }

export type Book = {
  next: () => void
  prev: () => void
  first: () => void
  last: () => void
  destroy: () => void
}

const ASSETS = '/pdfjs/'
/** Pages drawn on each side of the open page, and the distance after which a page is freed. */
const DRAW_AHEAD = 3
const KEEP_AROUND = 10
/** Below twice this block width the book shows one page at a time. */
const MIN_PAGE_WIDTH = 300

export async function openBook(
  host: HTMLElement,
  src: string,
  onStatus: (status: BookStatus) => void,
): Promise<Book> {
  let destroyed = false
  let task: PDFDocumentLoadingTask | null = null
  let doc: PDFDocumentProxy | null = null
  let flip: PageFlip | null = null
  const cleanup = () => {
    destroyed = true
    window.removeEventListener('resize', onResize)
    try {
      flip?.destroy()
    } catch {
      // Already torn down with its host.
    }
    void task?.destroy()
  }
  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => drawAround(flip?.getCurrentPageIndex() ?? 0, true), 250)
  }

  onStatus({ kind: 'loading', progress: null })
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}pdf.worker.min.mjs`
  task = pdfjs.getDocument({
    url: src,
    cMapUrl: `${ASSETS}cmaps/`,
    standardFontDataUrl: `${ASSETS}standard_fonts/`,
    iccUrl: `${ASSETS}iccs/`,
    wasmUrl: `${ASSETS}wasm/`,
    enableXfa: false,
  })
  task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
    if (!destroyed) onStatus({ kind: 'loading', progress: total ? loaded / total : null })
  }

  const idle: Book = { next() {}, prev() {}, first() {}, last() {}, destroy: cleanup }
  let base: { width: number; height: number }
  try {
    doc = await task.promise
    base = (await doc.getPage(1)).getViewport({ scale: 1 })
  } catch {
    if (!destroyed) onStatus({ kind: 'error' })
    return idle
  }
  const pdf = doc
  const ratio = base.width / base.height
  const pages = pdf.numPages

  const book = document.createElement('div')
  book.className = 'ebook-flip'
  host.append(book)
  const pageEls = Array.from({ length: pages }, (_, i) => {
    const el = document.createElement('div')
    el.className = 'ebook-page'
    el.setAttribute('aria-label', `Page ${i + 1}`)
    el.append(document.createElement('canvas'))
    return el
  })

  /** Width of one page on screen, in CSS pixels (as page-flip's stretch mode computes it). */
  const pageWidth = (): number => {
    const w = book.clientWidth || host.clientWidth
    const h = book.clientHeight || host.clientHeight
    const single = w < MIN_PAGE_WIDTH * 2
    return Math.min(single ? w : w / 2, h * ratio)
  }

  const drawn = new Map<number, number>() // page index → scale it was drawn at
  const drawing = new Set<number>()
  async function draw(index: number, scale: number) {
    if (drawing.has(index) || (drawn.get(index) ?? 0) >= scale * 0.9) return
    drawing.add(index)
    try {
      const page = await pdf.getPage(index + 1)
      if (destroyed) return
      const viewport = page.getViewport({ scale })
      const canvas = pageEls[index]!.querySelector('canvas')!
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport }).promise
      drawn.set(index, scale)
      pageEls[index]!.dataset.ready = ''
    } catch {
      // A page that fails to draw stays blank; the rest of the book still reads.
    } finally {
      drawing.delete(index)
    }
  }

  function drawAround(index: number, resized = false) {
    if (destroyed) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const scale = Math.max((pageWidth() * dpr) / base.width, 0.5)
    if (resized) drawn.clear()
    for (const [i] of drawn) {
      if (Math.abs(i - index) > KEEP_AROUND) {
        const canvas = pageEls[i]!.querySelector('canvas')!
        canvas.width = canvas.height = 0
        delete pageEls[i]!.dataset.ready
        drawn.delete(i)
      }
    }
    // The open page(s) first, then outwards.
    const order = [0, 1, -1, 2, -2, 3, -3].filter((d) => Math.abs(d) <= DRAW_AHEAD)
    for (const d of order) {
      const i = index + d
      if (i >= 0 && i < pages) void draw(i, scale)
    }
  }

  const { PageFlip } = await import('page-flip/dist/js/page-flip.module.js')
  if (destroyed) return idle
  flip = new PageFlip(book, {
    width: 600,
    height: Math.round(600 / ratio),
    size: 'stretch',
    minWidth: MIN_PAGE_WIDTH,
    maxWidth: 2000,
    minHeight: 200,
    maxHeight: 3000,
    autoSize: false,
    // No single-cover mode: page-flip jumps (no animation) and re-centres the book when the cover turns.
    showCover: false,
    usePortrait: true,
    mobileScrollSupport: false,
    drawShadow: true,
    maxShadowOpacity: 0.45,
    flippingTime: 700,
  })
  const report = () =>
    onStatus({
      kind: 'ready',
      page: (flip?.getCurrentPageIndex() ?? 0) + 1,
      pages,
      portrait: flip?.getOrientation() === 'portrait',
    })
  flip.on('flip', (e) => {
    drawAround(e.data)
    report()
  })
  flip.on('changeOrientation', () => {
    drawAround(flip?.getCurrentPageIndex() ?? 0, true)
    report()
  })
  flip.loadFromHTML(pageEls)
  window.addEventListener('resize', onResize)
  drawAround(0)
  report()

  // A jump does not fire page-flip's 'flip' event.
  const turnTo = (index: number) => {
    flip?.turnToPage(index)
    drawAround(index)
    report()
  }

  return {
    next: () => flip?.flipNext(),
    prev: () => flip?.flipPrev(),
    first: () => turnTo(0),
    last: () => turnTo(pages - 1),
    destroy: cleanup,
  }
}
