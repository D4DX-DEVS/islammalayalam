import { deflateSync } from 'node:zlib'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { MEDIA_FIELDS, POPULATE } from '@/features/shared'
import { checkFilePolicy, safeFilename, sniffKind } from '@/lib/media/file-policy'
import { scanPdf } from '@/lib/media/pdf-scan'
import { reencodeImage } from '@/lib/media/reencode'

const png = () =>
  sharp({ create: { width: 40, height: 30, channels: 3, background: '#1e73be' } })
    .png()
    .toBuffer()
const jpeg = () =>
  sharp({ create: { width: 40, height: 30, channels: 3, background: '#2196f3' } })
    .jpeg()
    .toBuffer()

/** Minimal synthetic PDF: `objects` are raw object bodies; optional Flate stream. */
function pdf(objects: string[], stream?: { dict: string; data: Buffer }): Buffer {
  const head = Buffer.from(
    `%PDF-1.7\n${objects.map((o, i) => `${i + 1} 0 obj\n${o}\nendobj\n`).join('')}`,
    'latin1',
  )
  if (!stream) return Buffer.concat([head, Buffer.from('%%EOF\n', 'latin1')])
  const n = objects.length + 1
  return Buffer.concat([
    head,
    Buffer.from(
      `${n} 0 obj\n<< ${stream.dict} /Length ${stream.data.length} >>\nstream\n`,
      'latin1',
    ),
    stream.data,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ])
}

describe('file policy', () => {
  it('identifies files by magic bytes, not by name or declared type', async () => {
    expect(sniffKind(await png())).toBe('png')
    expect(sniffKind(await jpeg())).toBe('jpeg')
    expect(sniffKind(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(sniffKind(Buffer.from('MZ\x90\x00 fake windows executable'))).toBeNull()
  })

  it('requires the extension to agree with the content', async () => {
    expect(checkFilePolicy(await png(), 'a.png')).toEqual({ ok: true, kind: 'png' })
    expect(checkFilePolicy(await png(), 'a.jpg').ok).toBe(false)
    expect(checkFilePolicy(Buffer.from('<?php echo 1; ?>........'), 'shell.php').ok).toBe(false)
    expect(checkFilePolicy(await png(), 'a.png.php').ok).toBe(false)
    expect(checkFilePolicy(Buffer.from('<svg></svg>.......'), 'x.svg').ok).toBe(false)
  })

  it('produces ASCII-safe filenames with the canonical extension', () => {
    expect(safeFilename('../../ഖുര്‍ആന്‍ Poster (1).JPEG', 'jpeg')).toBe('poster-1.jpg')
    expect(safeFilename('ഖുര്‍ആന്‍.png', 'png')).toBe('file.png')
  })
})

describe('reencodeImage', () => {
  it('drops anything appended after the image data (polyglot payloads)', async () => {
    const payload = Buffer.from('<script>alert(1)</script>')
    const out = await reencodeImage(Buffer.concat([await jpeg(), payload]), 'jpeg')
    expect(out.data.includes(payload)).toBe(false)
    expect(sniffKind(out.data)).toBe('jpeg')
  })

  it('caps the long edge at 2560px', async () => {
    const big = await sharp({
      create: { width: 4000, height: 1000, channels: 3, background: '#000' },
    })
      .jpeg()
      .toBuffer()
    const out = await reencodeImage(big, 'jpeg')
    expect(out.width).toBe(2560)
  })

  it('rejects files that do not decode as images', async () => {
    await expect(
      reencodeImage(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]), 'jpeg'),
    ).rejects.toThrow()
  })
})

describe('scanPdf', () => {
  it('accepts a plain document', () => {
    const r = scanPdf(
      pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>'], {
        dict: '/Filter /FlateDecode',
        data: deflateSync('BT (hello) Tj ET'),
      }),
    )
    expect(r).toMatchObject({ ok: true, findings: [] })
  })

  it.each([
    [
      'JavaScript action',
      '<< /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>',
      ['javascript', 'open_action'],
    ],
    ['launch action', '<< /S /Launch /F (cmd.exe) >>', ['launch']],
    ['embedded file', '<< /EmbeddedFiles 3 0 R >>', ['embedded_file']],
    ['hex-escaped name', '<< /S /J#61vaScript /JS (x) >>', ['javascript']],
    ['encrypted', '<< /Encrypt 5 0 R >>', ['encrypted']],
  ])('rejects %s', (_, obj, expected) => {
    const r = scanPdf(pdf([obj]))
    expect(r.ok).toBe(false)
    expect(r.findings).toEqual(expect.arrayContaining(expected))
  })

  it('does not mistake `endstream` for a new stream (multi-stream documents stay valid)', () => {
    const s1 = deflateSync('BT (page one) Tj ET')
    const s2 = deflateSync('BT (page two) Tj ET')
    const doc = Buffer.concat([
      Buffer.from(
        `%PDF-1.7\n1 0 obj\n<< /Filter /FlateDecode /Length ${s1.length} >>\nstream\n`,
        'latin1',
      ),
      s1,
      Buffer.from(
        `\nendstream\nendobj\n2 0 obj\n<< /Filter /FlateDecode /Length ${s2.length} >>\nstream\n`,
        'latin1',
      ),
      s2,
      Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
    ])
    expect(scanPdf(doc)).toMatchObject({ ok: true, findings: [], unreadableStreams: 0 })
  })

  it('finds actions hidden inside compressed object streams', () => {
    const r = scanPdf(
      pdf(['<< /Type /Catalog >>'], {
        dict: '/Type /ObjStm /Filter /FlateDecode',
        data: deflateSync('<< /S /JavaScript /JS (bad) >>'),
      }),
    )
    expect(r.findings).toContain('javascript')
  })

  it('treats encodings it cannot inspect, and corrupt streams, as unsafe', () => {
    expect(
      scanPdf(pdf([], { dict: '/Filter /ASCIIHexDecode', data: Buffer.from('3C3C2F533E3E>') }))
        .findings,
    ).toContain('opaque_filter')
    expect(
      scanPdf(pdf([], { dict: '/Filter /FlateDecode', data: Buffer.from('not zlib at all') }))
        .findings,
    ).toContain('unreadable_stream')
  })
})

describe('media fields read by the frontend', () => {
  it('include what the Spaces storage plugin needs to build file addresses', () => {
    // Without `prefix`/`_objectKey` the plugin drops the folder from every CDN URL → 403.
    for (const field of ['filename', 'sizes', 'prefix', '_objectKey', 'url'] as const) {
      expect(MEDIA_FIELDS, field).toHaveProperty(field, true)
    }
    expect(POPULATE.media).toBe(MEDIA_FIELDS)
  })
})
