/**
 * Copies pdf.js's worker and its data files (CMaps, standard fonts, ICC profiles, wasm decoders) from
 * node_modules into public/pdfjs/, so the e-book reader loads them from our own origin: the site CSP
 * allows workers and fetches from 'self' only. Runs after `npm install` and before every build;
 * public/pdfjs/ is generated, not committed.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', 'pdfjs-dist')
const out = join(root, 'public', 'pdfjs')

if (!existsSync(src)) {
  console.warn('[copy-pdfjs] pdfjs-dist is not installed; skipped')
  process.exit(0)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(join(src, 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'))
for (const dir of ['cmaps', 'standard_fonts', 'iccs', 'wasm'])
  cpSync(join(src, dir), join(out, dir), { recursive: true })
console.log('[copy-pdfjs] public/pdfjs ready')
