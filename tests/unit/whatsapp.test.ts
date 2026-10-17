import { describe, expect, it } from 'vitest'
import { whatsappLink } from '@/lib/whatsapp'

describe('whatsappLink', () => {
  it('builds a wa.me link from the number, keeping digits only', () => {
    expect(whatsappLink({ number: '+91 98765-43210' })).toBe('https://wa.me/919876543210')
  })

  it('pre-fills the greeting, trimmed, encoded and capped', () => {
    expect(whatsappLink({ number: '919876543210', message: '  Hi there  ' })).toBe(
      'https://wa.me/919876543210?text=Hi%20there',
    )
    const long = whatsappLink({ number: '919876543210', message: 'x'.repeat(500) })!
    expect(decodeURIComponent(long.split('text=')[1]!)).toHaveLength(300)
  })

  it('ignores a blank greeting', () => {
    expect(whatsappLink({ number: '919876543210', message: '   ' })).toBe(
      'https://wa.me/919876543210',
    )
  })

  it('rejects numbers that are too short or too long and falls back to the social link', () => {
    expect(whatsappLink({ number: '1234567' })).toBeNull()
    expect(whatsappLink({ number: '1'.repeat(16) })).toBeNull()
    expect(whatsappLink({ number: '12345', url: 'https://wa.me/919876543210' })).toBe(
      'https://wa.me/919876543210',
    )
  })

  it('only accepts https WhatsApp hosts as the fallback link', () => {
    expect(whatsappLink({ url: 'https://chat.whatsapp.com/abc123' })).toBe(
      'https://chat.whatsapp.com/abc123',
    )
    expect(whatsappLink({ url: 'http://wa.me/919876543210' })).toBeNull()
    expect(whatsappLink({ url: 'https://evil.example/wa.me' })).toBeNull()
    expect(whatsappLink({ url: 'not a url' })).toBeNull()
  })

  it('is null when nothing is set', () => {
    expect(whatsappLink({})).toBeNull()
    expect(whatsappLink({ number: '', message: 'hi', url: '' })).toBeNull()
  })
})
