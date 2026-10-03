import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { makeUser, statusOf, testPayload, type SessionUser } from './helpers'

let payload: Payload
let editor: SessionUser, author: SessionUser

beforeAll(async () => {
  payload = await testPayload()
  editor = await makeUser(payload, 'editor')
  author = await makeUser(payload, 'author')
})

const upload = (name: string, data: Buffer, mimetype: string, user: SessionUser = editor) =>
  payload.create({
    collection: 'media',
    data: { alt: 'test image' },
    file: { name, data, mimetype, size: data.length },
    user,
    overrideAccess: false,
  })
const jpeg = () =>
  sharp({ create: { width: 800, height: 500, channels: 3, background: '#1e73be' } })
    .jpeg()
    .toBuffer()
const png = () =>
  sharp({ create: { width: 64, height: 64, channels: 4, background: '#2196f3' } })
    .png()
    .toBuffer()
/** Structurally valid PDF (xref table + trailer) so Payload's own check passes and OUR scanner decides. */
function buildPdf(objects: Array<string | Buffer>): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n', 'latin1')]
  const offsets: number[] = []
  let size = parts[0]!.length
  objects.forEach((body, i) => {
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, 'latin1'),
      typeof body === 'string' ? Buffer.from(body, 'latin1') : body,
      Buffer.from('\nendobj\n', 'latin1'),
    ])
    offsets.push(size)
    parts.push(chunk)
    size += chunk.length
  })
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  parts.push(
    Buffer.from(
      `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`,
      'latin1',
    ),
  )
  return Buffer.concat(parts)
}
const catalog = '<< /Type /Catalog /Pages 2 0 R >>'
const pages = '<< /Type /Pages /Kids [] /Count 0 >>'
const flateStream = (dict: string, content: string) => {
  const data = deflateSync(content)
  return Buffer.concat([
    Buffer.from(`<< ${dict} /Filter /FlateDecode /Length ${data.length} >>\nstream\n`, 'latin1'),
    data,
    Buffer.from('\nendstream', 'latin1'),
  ])
}

describe('media guard', () => {
  it('accepts a real image, re-encodes it, strips the payload tail and generates WebP sizes', async () => {
    const tail = Buffer.from('<?php system($_GET["c"]); ?>')
    const doc = await upload(
      'Poster ഖുര്‍ആന്‍ 2022.JPG',
      Buffer.concat([await jpeg(), tail]),
      'image/jpeg',
    )
    expect(doc.filename).toMatch(/^poster-2022(-\d+)?\.jpg$/)
    expect(doc.mimeType).toBe('image/jpeg')
    expect(doc.sizes?.card?.mimeType).toBe('image/webp')
    const stored = await payload.findByID({ collection: 'media', id: doc.id, overrideAccess: true })
    expect(stored.security?.reencoded).toBe(true)
    expect(stored.sourceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.blurDataURL).toMatch(/^data:image\/webp;base64,/)
    const onDisk = await readFile(path.join('.test-media', doc.filename!))
    expect(onDisk.includes(tail)).toBe(false)
  })

  it.each([
    ['extension that does not match the content', 'photo.jpg', 'png'],
    ['SVG (scriptable image format)', 'logo.svg', 'svg'],
    ['text renamed to .png', 'notes.png', 'text'],
    ['PHP disguised as an image', 'shell.php.jpg', 'php'],
  ])('rejects %s', async (_, name, kind) => {
    const data =
      kind === 'png'
        ? await png()
        : kind === 'svg'
          ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
          : kind === 'php'
            ? Buffer.from('<?php echo 1; ?>' + ' '.repeat(40))
            : Buffer.from('just some text, not an image at all')
    expect(await statusOf(() => upload(name, data, 'image/png'))).toBe(400)
  })

  it('accepts a plain PDF (with compressed page content)', async () => {
    const ok = await upload(
      'ebook.pdf',
      buildPdf([catalog, pages, flateStream('', 'BT (hello) Tj ET')]),
      'application/pdf',
    )
    expect(ok.mimeType).toBe('application/pdf')
  })

  it.each([
    [
      'an OpenAction JavaScript',
      [
        `<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>`,
        pages,
      ],
    ],
    [
      'a Launch action hidden in a compressed object stream',
      [
        catalog,
        pages,
        flateStream('/Type /ObjStm /N 1 /First 4', '3 0 << /S /Launch /F (cmd.exe) >>'),
      ],
    ],
    ['a hex-escaped /JavaScript name', [catalog, pages, '<< /S /J#61vaScript /JS (x) >>']],
  ])('rejects a PDF with %s', async (_, objects) => {
    const err = await upload('book.pdf', buildPdf(objects as string[]), 'application/pdf').then(
      () => null,
      (e: Error & { status?: number }) => e,
    )
    expect(err?.status).toBe(400)
    expect(err?.message).toMatch(/active content/) // rejected by our scanner, not by a structural check
  })

  it('refuses remote-URL uploads before anything is fetched (REST body carries the url)', async () => {
    const { guardMediaUpload } = await import('@/payload/hooks/mediaGuard')
    const req = { data: { url: 'https://example.org/a.jpg', filename: 'a.jpg' }, context: {} }
    await expect(
      guardMediaUpload({ args: { data: {} }, operation: 'create', req } as never),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('never stores a media document whose bytes skipped the guard (backstop)', async () => {
    const { guardMediaUpload, rejectFilelessCreate } = await import('@/payload/hooks/mediaGuard')
    expect(() =>
      rejectFilelessCreate({ data: {}, operation: 'create', req: { context: {} } } as never),
    ).toThrow(/did not pass the media guard/)
    // A verdict left on a reused req by an earlier (failed) upload is cleared by the next operation.
    const reused = {
      data: {},
      context: { mediaGuard: { sourceSha256: 'stale', kind: 'jpeg', reencoded: true } },
    }
    await guardMediaUpload({ args: { data: {} }, operation: 'create', req: reused } as never)
    expect(() =>
      rejectFilelessCreate({ data: {}, operation: 'create', req: reused } as never),
    ).toThrow(/did not pass the media guard/)
  })

  it('lets authors upload but not delete', async () => {
    const doc = await upload('author.png', await png(), 'image/png', author)
    expect(
      await statusOf(() =>
        payload.delete({ collection: 'media', id: doc.id, user: author, overrideAccess: false }),
      ),
    ).toBe(403)
  })
})
