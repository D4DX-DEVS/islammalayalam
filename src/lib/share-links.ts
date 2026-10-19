/** The share-page links of the four networks (plain links, no third-party scripts). Pure. */
export type NetworkLinks = Record<'whatsapp' | 'facebook' | 'x' | 'telegram', string>

/**
 * `target` is the address being shared; `words` are the text that goes with it (a quote and its
 * source), left out when the thing shared is a picture and the address alone is the message.
 */
export function shareLinks(target: string, words = ''): NetworkLinks {
  const enc = encodeURIComponent
  const body = [words, target].filter(Boolean).join('\n')
  return {
    whatsapp: `https://wa.me/?text=${enc(body)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(target)}${words ? `&quote=${enc(words)}` : ''}`,
    x: `https://twitter.com/intent/tweet?url=${enc(target)}${words ? `&text=${enc(words)}` : ''}`,
    telegram: `https://t.me/share/url?url=${enc(target)}${words ? `&text=${enc(words)}` : ''}`,
  }
}
