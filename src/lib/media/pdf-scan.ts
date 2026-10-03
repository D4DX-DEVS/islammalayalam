import { constants, inflateSync } from 'node:zlib'

/**
 * Static PDF inspection: rejects PDFs that can run code or carry payloads.
 * Scans the raw bytes AND every Flate-compressed stream (names hidden inside object streams).
 * Never renders or executes the document.
 */
const DANGEROUS = [
  { id: 'javascript', re: /\/(?:JavaScript|JS)\b/ },
  { id: 'open_action', re: /\/OpenAction\b/ },
  { id: 'additional_actions', re: /\/AA\b/ },
  { id: 'launch', re: /\/Launch\b/ },
  { id: 'embedded_file', re: /\/EmbeddedFiles?\b/ },
  { id: 'rich_media', re: /\/RichMedia\b/ },
  { id: 'xfa', re: /\/XFA\b/ },
  { id: 'submit_form', re: /\/SubmitForm\b/ },
  { id: 'import_data', re: /\/ImportData\b/ },
  { id: 'go_to_remote', re: /\/GoToR\b|\/GoToE\b/ },
]
// Filters that can wrap objects in encodings this scanner does not decode → cannot be inspected.
const OPAQUE_FILTERS =
  /\/(?:ASCIIHexDecode|ASCII85Decode|LZWDecode|RunLengthDecode|AHx|A85|LZW|RL)\b/
const MAX_STREAMS = 5_000
const MAX_INFLATED_BYTES = 200 * 1024 * 1024

export type PdfScanResult = {
  ok: boolean
  findings: string[]
  unreadableStreams: number
  encrypted: boolean
}

export function scanPdf(buf: Buffer): PdfScanResult {
  const findings = new Set<string>()
  const text = buf.toString('latin1')
  const check = (chunk: string) => {
    const decoded = decodeNames(chunk)
    for (const d of DANGEROUS) if (d.re.test(decoded)) findings.add(d.id)
  }
  check(text)
  const encrypted = /\/Encrypt\b/.test(text)

  let unreadable = 0
  let inflatedTotal = 0
  let streams = 0
  // `stream` keyword only — never the tail of `endstream`.
  const streamRe = /(?<!end)stream\r?\n/g
  let m: RegExpExecArray | null
  while ((m = streamRe.exec(text)) && streams < MAX_STREAMS) {
    streams++
    const start = m.index + m[0].length
    const end = text.indexOf('endstream', start)
    if (end < 0) break
    // The stream's own dictionary: from this object's "N 0 obj" header up to the keyword.
    const objStart = text.lastIndexOf('obj', m.index)
    const dict = decodeNames(text.slice(Math.max(objStart, m.index - 4000, 0), m.index))
    if (OPAQUE_FILTERS.test(dict)) findings.add('opaque_filter')
    if (/\/(?:FlateDecode|Fl)\b/.test(dict)) {
      try {
        // SYNC_FLUSH tolerates trailing EOL bytes before `endstream` (common in valid PDFs).
        const out = inflateSync(buf.subarray(start, end), {
          maxOutputLength: 50 * 1024 * 1024,
          finishFlush: constants.Z_SYNC_FLUSH,
        })
        inflatedTotal += out.length
        if (inflatedTotal > MAX_INFLATED_BYTES) {
          findings.add('decompression_limit')
          break
        }
        check(out.toString('latin1'))
      } catch {
        unreadable++
      }
    }
    streamRe.lastIndex = end + 'endstream'.length
  }
  // Encrypted PDFs and corrupt compressed streams cannot be inspected → treated as unsafe.
  if (encrypted) findings.add('encrypted')
  if (unreadable > 0) findings.add('unreadable_stream')
  return {
    ok: findings.size === 0,
    findings: [...findings],
    unreadableStreams: unreadable,
    encrypted,
  }
}

/** PDF names may hex-escape characters (/J#61vaScript === /JavaScript); decode before matching. */
function decodeNames(chunk: string): string {
  return chunk.replace(/\/[^\s/<>[\]()%{}]+/g, (name) =>
    name.replace(/#([0-9a-fA-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))),
  )
}
