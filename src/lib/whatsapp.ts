/**
 * The "chat on WhatsApp" link. Preferred source is the number editors enter in Site settings
 * (https://wa.me/<digits>, with an optional greeting); a WhatsApp link entered under Social is the
 * fallback. Anything else yields null, so the button is simply not shown.
 */
const WHATSAPP_HOSTS = new Set(['wa.me', 'api.whatsapp.com', 'chat.whatsapp.com', 'whatsapp.com'])
const MESSAGE_MAX = 300

export function whatsappLink(input: {
  number?: string | null
  message?: string | null
  url?: string | null
}): string | null {
  const digits = (input.number ?? '').replace(/\D/g, '')
  if (digits.length >= 8 && digits.length <= 15) {
    const text = (input.message ?? '').trim().slice(0, MESSAGE_MAX)
    return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
  }
  const raw = input.url?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && WHATSAPP_HOSTS.has(url.hostname) ? url.toString() : null
  } catch {
    return null
  }
}
