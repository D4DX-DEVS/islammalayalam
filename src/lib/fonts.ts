import { Anek_Malayalam, Poppins } from 'next/font/google'

/**
 * The project's two typefaces, shared by the site and the admin. Self-hosted at build time by
 * next/font: no request ever goes to Google from a visitor's browser.
 *
 * - English: Poppins (everywhere, titles included)
 * - Malayalam (text and titles alike): Anek Malayalam
 *
 * Stacks list Poppins first: Anek Malayalam also ships Latin letters, and English must come from
 * Poppins. Malayalam letters are not in Poppins, so they fall through to Anek Malayalam. It uses
 * `display: block`, so Malayalam is never drawn in another (system) font while it loads; it is
 * preloaded and small, so the wait is short.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})
const anekMalayalam = Anek_Malayalam({
  subsets: ['malayalam'],
  variable: '--font-malayalam',
  display: 'block',
  adjustFontFallback: false, // an Arial-based stand-in has no Malayalam letters anyway
})

/** Put on <html>: defines the --font-* variables used by the CSS stacks. */
export const fontVariables = `${poppins.variable} ${anekMalayalam.variable}`
