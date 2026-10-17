import { Figtree, Noto_Sans_Malayalam } from 'next/font/google'

/**
 * The admin's typefaces (the public site keeps its own pair in ./fonts.ts). Self-hosted at build
 * time by next/font, so no request goes to Google from an editor's browser.
 *
 * - English: Figtree
 * - Malayalam: Noto Sans Malayalam, with the same weights, so mixed lines keep one rhythm
 *
 * Stacks list Figtree first; Malayalam letters are not in it and fall through to Noto Sans
 * Malayalam. `display: block` for Malayalam so it is never drawn in a system font while loading.
 */
const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
})
const notoSansMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam'],
  variable: '--font-noto-malayalam',
  display: 'block',
  adjustFontFallback: false, // an Arial-based stand-in has no Malayalam letters anyway
})

/** Put on <html> in the admin layout: defines the --font-* variables used by custom.scss. */
export const adminFontVariables = `${figtree.variable} ${notoSansMalayalam.variable}`
