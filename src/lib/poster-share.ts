/**
 * Browser-side: turns an insight's poster into the picture that gets shared — the poster with the
 * website address ("islammalayalam.net") on a strip under it — and delivers that image file.
 * A web page cannot attach an image to a WhatsApp / Facebook / X / Telegram link, so:
 *  - wherever the browser can share files (phones and tablets, and Chrome / Edge / Safari on a
 *    computer) the image goes to the device's share sheet, and every app in it receives the image
 *    file itself, with the address as its caption;
 *  - otherwise the picture is copied to the clipboard and the network's own share page opens with
 *    the address already in the message, ready for a paste (or, when the browser will not copy
 *    images, the picture is saved to the downloads folder instead).
 */
export type PosterNetwork = 'whatsapp' | 'facebook' | 'x' | 'telegram'

export type PosterPicture = { canvas: HTMLCanvasElement; jpeg: File }

/** The paste shortcut to name in a hint. */
export const pasteKeys = (userAgent: string): string =>
  /Mac|iPhone|iPad/.test(userAgent) ? '⌘ + V' : 'Ctrl + V'

/** The site's public domain: what is printed under a shared poster, whatever address the page was opened on. */
export const PUBLIC_DOMAIN = 'islammalayalam.net'

/**
 * "islammalayalam.net" for the line under a poster: the host of the address it was opened on,
 * without "www.", except on a development address (localhost, an IP address, a name with no dot),
 * where it is the public domain: nobody should be sent a "localhost:3444" poster.
 */
export const siteAddress = (url: string): string => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return !host.includes('.') || /^\d+(\.\d+){3}$/.test(host) ? PUBLIC_DOMAIN : host
  } catch {
    return PUBLIC_DOMAIN
  }
}

const STRIP_COLOUR = '#041d4d'
const STRIP_RULE = '#f0a400'

const blobOf = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made'))),
      type,
      quality,
    ),
  )

/**
 * The poster is read through the site's own image endpoint: the page's security policy only lets it
 * talk to its own origin, so the media CDN cannot be fetched directly.
 */
const sameOrigin = (src: string): string =>
  src.startsWith('/') ? src : `/_next/image?url=${encodeURIComponent(src)}&w=1200&q=90`

async function compose(src: string, address: string): Promise<PosterPicture> {
  const res = await fetch(sameOrigin(src))
  if (!res.ok) throw new Error(`The poster answered ${res.status}`)
  const image = await createImageBitmap(await res.blob())
  const { width, height } = image
  const strip = Math.round(width * 0.09)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height + strip
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas')
  ctx.drawImage(image, 0, 0)
  image.close()
  ctx.fillStyle = STRIP_COLOUR
  ctx.fillRect(0, height, width, strip)
  ctx.fillStyle = STRIP_RULE
  ctx.fillRect(0, height, width, Math.max(2, Math.round(width * 0.004)))
  await document.fonts?.ready
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
  let size = Math.round(strip * 0.4)
  const font = () => `600 ${size}px ${family}`
  ctx.font = font()
  while (ctx.measureText(address).width > width * 0.9 && size > 12) {
    size -= 2
    ctx.font = font()
  }
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(address, width / 2, height + strip / 2 + 1)
  const jpeg = await blobOf(canvas, 'image/jpeg', 0.92)
  return { canvas, jpeg: new File([jpeg], 'islam-malayalam-insight.jpg', { type: 'image/jpeg' }) }
}

const pictures = new Map<string, Promise<PosterPicture>>()

/** The shareable picture of a poster; made once, so it is ready by the time a button is pressed. */
export function posterPicture(src: string, address: string): Promise<PosterPicture> {
  const key = `${src}\n${address}`
  let found = pictures.get(key)
  if (!found) {
    found = compose(src, address)
    pictures.set(key, found)
    found.catch(() => pictures.delete(key))
  }
  return found
}

const canShareFile = (file: File): boolean =>
  typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

/** True when this browser can hand an image file to the device's share sheet (phones, and Chrome / Edge / Safari on a computer). */
export const canShareImages = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof File === 'function' &&
  canShareFile(new File(['x'], 'poster.jpg', { type: 'image/jpeg' }))

/** Saves the file to the downloads folder. */
export function save(file: File) {
  const href = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = href
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000)
}

/** What happened to the picture: handed to an app, copied for pasting, or saved to the downloads. */
export type PosterOutcome = 'shared' | 'copied' | 'saved' | 'cancelled'

/**
 * Delivers the picture. `to` is a network's button, or 'device' for the "More" button. The device's
 * share sheet comes first wherever the browser can use it (the image file reaches the app chosen,
 * with `caption`, the website address, under it). Otherwise the picture is copied and `href`, the
 * network's own share link carrying that address, opens for a paste.
 */
export async function sendPoster(
  picture: PosterPicture,
  to: PosterNetwork | 'device',
  { caption, href }: { caption: string; href?: string },
): Promise<PosterOutcome> {
  if (canShareFile(picture.jpeg)) {
    try {
      await navigator.share({ files: [picture.jpeg], text: caption })
      return 'shared'
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'cancelled'
    }
  }
  const open = () => href && window.open(href, '_blank', 'noopener,noreferrer')
  if (to !== 'device') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobOf(picture.canvas, 'image/png') }),
      ])
      open()
      return 'copied'
    } catch {
      // The browser would not copy an image (older browser, or permission refused): save it instead.
    }
  }
  save(picture.jpeg)
  if (to !== 'device') open()
  return 'saved'
}
