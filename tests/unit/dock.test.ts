import { describe, expect, it } from 'vitest'
import { activeTab, sheetDismissed, type DockTarget } from '@/lib/dock'

const SITE: DockTarget[] = [
  { href: '/', exact: true },
  { href: '/insights/' },
  { href: '/audios/' },
  { href: '/search/' },
  {},
]

const ADMIN: DockTarget[] = [
  { href: '/admin', exact: true },
  { href: '/admin/collections/posts' },
  {},
  { href: '/admin/collections/contact-messages', also: ['/admin/collections/postal-requests'] },
  {},
]

describe('activeTab', () => {
  it('lights Home only on the home page itself', () => {
    expect(activeTab('/', SITE)).toBe(0)
    expect(activeTab('/4306/', SITE)).toBe(-1)
  })

  it('lights a section tab for the section and everything below it', () => {
    expect(activeTab('/insights/', SITE)).toBe(1)
    expect(activeTab('/insights', SITE)).toBe(1)
    expect(activeTab('/audios/some-episode/', SITE)).toBe(2)
    expect(activeTab('/search/', SITE)).toBe(3)
  })

  it('does not treat a longer name as the same section', () => {
    expect(activeTab('/audiosx/', SITE)).toBe(-1)
    expect(activeTab('/admin/collections/postal', ADMIN)).toBe(-1)
  })

  it('maps admin screens, including sections shared by one tab', () => {
    expect(activeTab('/admin', ADMIN)).toBe(0)
    expect(activeTab('/admin/', ADMIN)).toBe(0)
    expect(activeTab('/admin/collections/posts/6ae2', ADMIN)).toBe(1)
    expect(activeTab('/admin/collections/postal-requests', ADMIN)).toBe(3)
    expect(activeTab('/admin/collections/contact-messages/12', ADMIN)).toBe(3)
    expect(activeTab('/admin/collections/media', ADMIN)).toBe(-1)
  })

  it('never lights tabs without a destination', () => {
    expect(activeTab('/anything', [{}, {}])).toBe(-1)
  })
})

describe('sheetDismissed', () => {
  it('closes after a long enough pull down', () => {
    expect(sheetDismissed(120, 600)).toBe(true)
    expect(sheetDismissed(60, 600)).toBe(false)
  })

  it('closes on a quick flick even when short', () => {
    expect(sheetDismissed(40, 60)).toBe(true)
    expect(sheetDismissed(10, 10)).toBe(false)
  })

  it('never closes on an upward or zero-time pull', () => {
    expect(sheetDismissed(-200, 100)).toBe(false)
    expect(sheetDismissed(50, 0)).toBe(false)
  })
})
