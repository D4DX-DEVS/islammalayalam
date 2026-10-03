import { beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import {
  linkNode,
  makeUser,
  paragraph,
  richText,
  statusOf,
  testPayload,
  text,
  type SessionUser,
} from './helpers'

let payload: Payload
let editor: SessionUser

beforeAll(async () => {
  payload = await testPayload()
  editor = await makeUser(payload, 'editor')
})

const createPost = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'posts',
    data: { title: 'Guarded', ...data } as never,
    user: editor,
    overrideAccess: false,
    draft: true,
  })

describe('content integrity guard (every write, editors and migration alike)', () => {
  it.each([
    ['script tag in a plain field', { excerpt: 'hello <script src="x"></script>' }],
    ['legacy IOC in the title', { title: 'see interseq.at now' }],
    [
      'javascript: link in rich text',
      { content: richText(paragraph(linkNode('javascript:alert(1)'))) },
    ],
    [
      'raw HTML node in rich text',
      { content: richText({ type: 'html', html: '<img onerror=x>', version: 1 }) },
    ],
    [
      'block type outside the allowlist',
      {
        content: richText({
          type: 'block',
          fields: { blockType: 'rawHtml', html: '<b>' },
          version: 2,
        }),
      },
    ],
    ['obfuscated loader in a caption', { excerpt: "var _0x50ad=atob('QUJD')" }],
  ])('rejects %s', async (_, data) => {
    expect(await statusOf(() => createPost(data))).toBe(400)
  })

  it('rejects the same payloads even with overrideAccess (the migration path)', async () => {
    expect(
      await statusOf(() =>
        payload.create({
          collection: 'pages',
          data: {
            title: 'x',
            slug: 'x',
            intro: richText(paragraph(text('xdav_tracker'))),
          } as never,
          overrideAccess: true,
        }),
      ),
    ).toBe(400)
  })

  it('guards globals too (menus, homepage blocks)', async () => {
    const badMenu = {
      mainMenu: [{ link: { type: 'custom', label: 'x', url: 'javascript:alert(1)' } }],
    }
    expect(
      await statusOf(() =>
        payload.updateGlobal({
          slug: 'header',
          data: badMenu as never,
          user: editor,
          overrideAccess: false,
        }),
      ),
    ).toBe(400)
    const badBlock = {
      layout: [{ blockType: 'richText', content: richText(paragraph(text('<?php system(1) ?>'))) }],
    }
    expect(
      await statusOf(() =>
        payload.updateGlobal({
          slug: 'homepage',
          data: badBlock as never,
          user: editor,
          overrideAccess: false,
        }),
      ),
    ).toBe(400)
  })

  it('accepts clean Malayalam (ZWJ preserved) and derives search text + reading time', async () => {
    const body = 'ഖുര്‍ആന്‍ പഠനം '.repeat(200)
    const post = await createPost({
      title: 'ഖുര്‍ആന്‍',
      content: richText(paragraph(text(body)), paragraph(linkNode('https://example.org'))),
    })
    const stored = await payload.findByID({
      collection: 'posts',
      id: post.id,
      overrideAccess: true,
      draft: true,
      showHiddenFields: true,
    })
    expect(stored.title).toBe('ഖുര്‍ആന്‍') // ZWJ kept in text
    expect(stored.readingMinutes).toBeGreaterThanOrEqual(2)
    expect(stored.searchText).toContain('ഖുര്‍ആന്‍ പഠനം')
  })

  it('normalises slugs (legacy chillu → atomic, invisible characters removed)', async () => {
    const cat = await payload.create({
      collection: 'categories',
      data: { name: 'ആദര്‍ശം', slug: 'ആദര്‍ശം‌' },
      user: editor,
      overrideAccess: false,
    })
    expect(cat.slug).toBe('ആദർശം')
  })

  it('rejects unsafe URLs even in drafts (Payload skips field validators for drafts)', async () => {
    expect(
      await statusOf(() => createPost({ format: 'audio', audio: { url: 'javascript:alert(1)' } })),
    ).toBe(400)
    expect(
      await statusOf(() =>
        createPost({ format: 'video', video: { url: 'data:text/html,<b>x</b>' } }),
      ),
    ).toBe(400)
  })

  it('field validators run on publish (YouTube-only video, https-only audio)', async () => {
    const publish = (data: Record<string, unknown>) =>
      payload.create({
        collection: 'posts',
        data: { title: 'Pub', _status: 'published', ...data } as never,
        user: editor,
        overrideAccess: false,
      })
    expect(
      await statusOf(() =>
        publish({
          format: 'video',
          video: { url: 'https://attacker.invalid/watch?v=dQw4w9WgXcQ' },
        }),
      ),
    ).toBe(400)
    expect(
      await statusOf(() =>
        publish({ format: 'audio', audio: { url: 'http://insecure.example/a.mp3' } }),
      ),
    ).toBe(400)
    const ok = await publish({ format: 'video', video: { url: 'https://youtu.be/dQw4w9WgXcQ' } })
    expect(ok.video?.youtubeId).toBe('dQw4w9WgXcQ')
  })
})
