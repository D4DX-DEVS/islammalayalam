import sharp from 'sharp'
import { normalizePath } from '@/lib/text/slug'

/**
 * Synthetic development fixtures. NOTHING here is WordPress content: titles/bodies are generated
 * placeholders that say so. Only STRUCTURE (menu tree, category names) mirrors the audit, so the
 * layout can be built and checked before the gated migration exists.
 */
type TextNode = {
  type: 'text'
  text: string
  format: number
  style: string
  mode: 'normal'
  detail: number
  version: 1
}
const text = (value: string, format = 0): TextNode => ({
  type: 'text',
  text: value,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
})
const block = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
})

export const paragraph = (value: string) =>
  block('paragraph', [text(value)], { textFormat: 0, textStyle: '' })
export const heading = (value: string, tag: 'h2' | 'h3' = 'h2') =>
  block('heading', [text(value)], { tag })
export const lexical = (children: unknown[]) => ({ root: block('root', children) })

const SENTENCES = [
  'ഇത് വികസന പരിസ്ഥിതിക്കായി സൃഷ്ടിച്ച മാതൃകാ ഉള്ളടക്കമാണ്; യഥാർത്ഥ ലേഖനങ്ങൾ മൈഗ്രേഷനിലൂടെ പിന്നീട് എത്തും.',
  'പേജിന്റെ രൂപകൽപ്പന, അക്ഷരങ്ങളുടെ വലിപ്പം, വരികൾക്കിടയിലെ അകലം എന്നിവ പരിശോധിക്കാനാണ് ഈ വാചകങ്ങൾ.',
  'മലയാളം ചില്ലക്ഷരങ്ങൾ — ൺ ൻ ർ ൽ ൾ — ശരിയായി പ്രദർശിപ്പിക്കപ്പെടുന്നുണ്ടോ എന്നും ഇതിലൂടെ ഉറപ്പാക്കാം.',
  'നീണ്ട ഖണ്ഡികകൾ മൊബൈൽ സ്ക്രീനിൽ എങ്ങനെ കാണപ്പെടുന്നു എന്ന് നോക്കുന്നതിനായി ഈ വാചകം അല്പം ദൈർഘ്യമേറിയതാക്കിയിരിക്കുന്നു.',
]

export function sampleBody(seed: number): ReturnType<typeof lexical> {
  const pick = (i: number) => SENTENCES[(seed + i) % SENTENCES.length]!
  return lexical([
    paragraph(`${pick(0)} ${pick(1)}`),
    heading('ഉപശീർഷകം'),
    paragraph(`${pick(2)} ${pick(3)} ${pick(0)}`),
    paragraph(pick(1)),
  ])
}

export const sampleTitle = (category: string, i: number): string =>
  `${category}: മാതൃകാ ലേഖനം ${i + 1}`

// Varied, photo-like tones so layouts can be judged before real images arrive (migration).
const PALETTES: Array<[string, string]> = [
  ['#0b3d91', '#1a6bc4'],
  ['#0f766e', '#2dd4bf'],
  ['#7c2d12', '#f97316'],
  ['#1e1b4b', '#6366f1'],
  ['#14532d', '#22c55e'],
  ['#334155', '#94a3b8'],
  ['#831843', '#f472b6'],
  ['#0c4a6e', '#38bdf8'],
  ['#78350f', '#fbbf24'],
  ['#312e81', '#a78bfa'],
  ['#134e4a', '#14b8a6'],
  ['#1f2937', '#3b82f6'],
]

/** Deterministic placeholder artwork: gradient + eight-point-star lattice + rosette. No text. */
export async function placeholderImage(i: number): Promise<Buffer> {
  const [a, b] = PALETTES[i % PALETTES.length]!
  const x = 260 + ((i * 197) % 680)
  const y = 190 + ((i * 131) % 370)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="#ffffff" stroke-opacity="0.13" stroke-width="1.5">
          <rect x="22" y="22" width="36" height="36"/>
          <rect x="22" y="22" width="36" height="36" transform="rotate(45 40 40)"/>
        </g>
      </pattern>
      <radialGradient id="r" cx="${(x / 1200).toFixed(2)}" cy="${(y / 750).toFixed(2)}" r="0.55">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.30"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="750" fill="url(#g)"/>
    <rect width="1200" height="750" fill="url(#p)"/>
    <rect width="1200" height="750" fill="url(#r)"/>
    <g transform="translate(${x} ${y})" fill="none" stroke="#ffffff" stroke-opacity="0.38" stroke-width="3">
      <rect x="-140" y="-140" width="280" height="280"/>
      <rect x="-140" y="-140" width="280" height="280" transform="rotate(45)"/>
      <circle r="92"/><circle r="40" stroke-opacity="0.25"/>
    </g>
  </svg>`
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer()
}

/** Decode the few HTML entities present in the archived menu titles (&#x200d; etc.). */
export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .normalize('NFC')
}

/** '/ആദര്‍ശം/വിശ്വാസം/' → ['ആദർശം', 'വിശ്വാസം'] (canonical) or null for '#', '/', /category/… */
export function pageSegments(href: string): string[] | null {
  if (!href.startsWith('/') || href === '/' || href.startsWith('/category/')) return null
  const segments = normalizePath(href)
  return segments && segments.length ? segments : null
}
