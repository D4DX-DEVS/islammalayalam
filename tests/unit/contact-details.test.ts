import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ContactDetails, emailsOf, telHref } from '@/components/layout/ContactDetails'

const contact = {
  email: 'dialogueck@gmail.com',
  secondEmail: 'dialoguemedia.in@gmail.com',
  phone: '+91 9567 696 982',
  address: 'Dialogue Centre Kerala\nHira Centre, Mavoor Road\nKozhikode, 673 004',
}
const html = (props: Partial<Parameters<typeof ContactDetails>[0]> = {}) =>
  renderToStaticMarkup(createElement(ContactDetails, { contact, ...props }))

describe('emailsOf', () => {
  it('lists the first email and then the second', () => {
    expect(emailsOf(contact)).toEqual(['dialogueck@gmail.com', 'dialoguemedia.in@gmail.com'])
  })
  it('skips an empty second email, a repeat, and blanks', () => {
    expect(emailsOf({ email: 'a@x.org' })).toEqual(['a@x.org'])
    expect(emailsOf({ email: 'a@x.org', secondEmail: 'a@x.org' })).toEqual(['a@x.org'])
    expect(emailsOf({ email: ' ', secondEmail: ' b@x.org ' })).toEqual(['b@x.org'])
    expect(emailsOf(null)).toEqual([])
  })
})

describe('telHref', () => {
  it('keeps the digits and the leading +', () => {
    expect(telHref('+91 9567 696 982')).toBe('tel:+919567696982')
    expect(telHref('(0495) 272-0000')).toBe('tel:04952720000')
  })
})

describe('ContactDetails', () => {
  it('shows the address, the phone and both emails as links', () => {
    const out = html()
    expect(out).toContain('Hira Centre, Mavoor Road')
    expect(out).toContain('href="tel:+919567696982"')
    expect(out).toContain('href="mailto:dialogueck@gmail.com"')
    expect(out).toContain('href="mailto:dialoguemedia.in@gmail.com"')
  })

  it('keeps the address on its own lines', () => {
    expect(html()).toContain('whitespace-pre-line')
  })

  it('captions each detail only when asked, and says "Emails" for two', () => {
    expect(html()).not.toContain('Address')
    const out = html({ labels: true })
    for (const label of ['Address', 'Phone', 'Emails']) expect(out).toContain(`>${label}<`)
    expect(html({ labels: true, contact: { email: 'a@x.org' } })).toContain('>Email<')
  })

  it('leaves out what is not set, and is empty with no contact details', () => {
    const out = html({ contact: { email: 'a@x.org' } })
    expect(out).not.toContain('tel:')
    expect(out).not.toContain('Hira Centre')
    expect(html({ contact: null })).not.toContain('<a ')
  })

  it('has a look for the dark footer and one for a white panel', () => {
    expect(html({ tone: 'dark' })).toContain('text-white/75')
    expect(html({ tone: 'light' })).toContain('text-brand')
  })
})
