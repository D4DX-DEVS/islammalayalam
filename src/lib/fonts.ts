import { Anek_Malayalam, Noto_Sans_Malayalam, Poppins } from 'next/font/google'

/**
 * The project's three typefaces, shared by the site and the admin. Self-hosted at build time by
 * next/font: no request ever goes to Google from a visitor's browser.
 *
 * - English: Poppins (everywhere, titles included)
 * - Malayalam text: Noto Sans Malayalam
 * - Malayalam titles: Anek Malayalam
 *
 * Stacks list Poppins first: these Malayalam fonts also ship Latin letters, and English must come
 * from Poppins. Malayalam letters are not in Poppins, so they fall through to the Malayalam face.
 * The Malayalam faces use `display: block`, so text is never drawn in another (system) Malayalam
 * font while they load; they are preloaded and small, so the wait is short.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})
const notoMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam'],
  variable: '--font-malayalam',
  display: 'block',
  adjustFontFallback: false, // an Arial-based stand-in has no Malayalam letters anyway
})
const anekMalayalam = Anek_Malayalam({
  subsets: ['malayalam'],
  variable: '--font-display-ml',
  display: 'block',
  adjustFontFallback: false, // an Arial-based stand-in has no Malayalam letters anyway
})

/** Put on <html>: defines the --font-* variables used by the CSS stacks. */
export const fontVariables = `${poppins.variable} ${notoMalayalam.variable} ${anekMalayalam.variable}`
