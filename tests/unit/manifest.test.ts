import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MetadataRoute } from 'next'
import { describe, expect, it } from 'vitest'
import siteManifest from '@/app/manifest'
import { adminManifest } from '@/lib/admin-app'

/** Width × height from a PNG's IHDR chunk. */
function pngSize(file: string): string {
  const png = readFileSync(file)
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`
}

const inScope = (url: string, scope: string): boolean => url === scope || url.startsWith(scope)

function checkInstallable(m: MetadataRoute.Manifest) {
  expect(m.name).toBeTruthy()
  expect(m.short_name).toBeTruthy()
  expect(m.display).toBe('standalone')
  expect(inScope(m.start_url ?? '', m.scope ?? '')).toBe(true)
  const icons = m.icons ?? []
  for (const size of ['192x192', '512x512'])
    expect(icons.some((i) => i.sizes === size && i.purpose !== 'maskable')).toBe(true)
  expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
  for (const shortcut of m.shortcuts ?? []) expect(inScope(shortcut.url, m.scope ?? '')).toBe(true)
}

/** Every icon / screenshot exists in public/ with the size the manifest claims. */
function checkFiles(m: MetadataRoute.Manifest) {
  const images = [
    ...(m.icons ?? []),
    ...(m.screenshots ?? []),
    ...(m.shortcuts ?? []).flatMap((s) => s.icons ?? []),
  ]
  for (const image of images) {
    const file = join('public', image.src)
    expect(existsSync(file), image.src).toBe(true)
    if (image.sizes) expect(pngSize(file), image.src).toBe(image.sizes)
  }
}

describe('site manifest', () => {
  const m = siteManifest()

  it('is installable, with its colours matching the white header', () => {
    checkInstallable(m)
    expect(m.scope).toBe('/')
    expect(m.theme_color).toBe('#ffffff')
  })

  it('offers phone and computer screenshots for the richer install sheet', () => {
    const factors = (m.screenshots ?? []).map((s) => s.form_factor)
    expect(factors).toEqual(expect.arrayContaining(['narrow', 'wide']))
  })

  it('points only at files that exist, at their real sizes', () => checkFiles(m))
})

describe('admin manifest', () => {
  it('is its own app, kept to /admin', () => {
    checkInstallable(adminManifest)
    expect(adminManifest.id).toBe('/admin')
    expect(adminManifest.scope).toBe('/admin')
    expect(adminManifest.id).not.toBe(siteManifest().id)
    expect(adminManifest.icons?.every((i) => i.src.startsWith('/brand/admin-'))).toBe(true)
  })

  it('points only at files that exist, at their real sizes', () => checkFiles(adminManifest))
})
