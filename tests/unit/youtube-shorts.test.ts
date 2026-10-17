import { describe, expect, it } from 'vitest'
import { parseShortsPage, shortsPage, splitTitle } from '@/lib/youtube-shorts'
import { ShortsBlock } from '@/payload/blocks/homepage-engage'

const lockup = (id: string, title: string, views = '2.2K views') => ({
  shortsLockupViewModel: {
    entityId: `shorts-shelf-item-${id}`,
    onTap: { innertubeCommand: { reelWatchEndpoint: { videoId: id } } },
    overlayMetadata: { primaryText: { content: title }, secondaryText: { content: views } },
  },
})
const page = (...items: unknown[]) =>
  `<html><script>var ytInitialData = ${JSON.stringify({
    contents: { grid: { items: items.map((content) => ({ richItemRenderer: { content } })) } },
  })};</script></html>`

describe('shortsPage (which page is asked for)', () => {
  it.each([
    ['@Dialogue_Media', 'https://www.youtube.com/@Dialogue_Media/shorts'],
    ['Dialogue_Media', 'https://www.youtube.com/@Dialogue_Media/shorts'],
    ['  @Dialogue_Media  ', 'https://www.youtube.com/@Dialogue_Media/shorts'],
    ['https://www.youtube.com/@Dialogue_Media', 'https://www.youtube.com/@Dialogue_Media/shorts'],
    [
      'https://www.youtube.com/@Dialogue_Media/videos',
      'https://www.youtube.com/@Dialogue_Media/shorts',
    ],
    [
      'https://m.youtube.com/@Dialogue_Media/shorts',
      'https://www.youtube.com/@Dialogue_Media/shorts',
    ],
    ['UCD-7wsqHJ8_DRs2TEeP041Q', 'https://www.youtube.com/channel/UCD-7wsqHJ8_DRs2TEeP041Q/shorts'],
    [
      'https://www.youtube.com/channel/UCD-7wsqHJ8_DRs2TEeP041Q',
      'https://www.youtube.com/channel/UCD-7wsqHJ8_DRs2TEeP041Q/shorts',
    ],
  ])('%s', (input, expected) => expect(shortsPage(input)).toBe(expected))

  it.each([
    '',
    '   ',
    '@a',
    'https://evil.example/@Dialogue_Media',
    'http://www.youtube.com/@Dialogue_Media',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://www.youtube.com/channel/not-a-channel-id',
    'https://youtube.com.evil.example/@Dialogue_Media',
    'javascript:alert(1)',
    '@bad handle',
  ])('refuses %j', (input) => expect(shortsPage(input)).toBeNull())

  it('refuses nothing-at-all', () => {
    expect(shortsPage(null)).toBeNull()
    expect(shortsPage(undefined)).toBeNull()
  })
})

describe('splitTitle', () => {
  it('keeps the headline and the speaker, drops the channel names', () => {
    expect(
      splitTitle(
        'ഇത് സൂഫിസമല്ല ! | ജി.കെ എടത്തനാട്ടുകര | Dialogue centre kerala | Dialogue Media |',
      ),
    ).toEqual({ title: 'ഇത് സൂഫിസമല്ല !', subtitle: 'ജി.കെ എടത്തനാട്ടുകര' })
  })

  it('has no speaker when the next part is the channel or a hashtag', () => {
    expect(splitTitle('ഒരു കഥ | Dialogue centre kerala')).toEqual({
      title: 'ഒരു കഥ',
      subtitle: null,
    })
    expect(splitTitle('A talk | #hashtag')).toEqual({ title: 'A talk', subtitle: null })
  })

  it('keeps a title with no separators whole', () => {
    expect(splitTitle('മനുഷ്യരെല്ലാം ഒന്നാണ്.')).toEqual({
      title: 'മനുഷ്യരെല്ലാം ഒന്നാണ്.',
      subtitle: null,
    })
  })

  it('does not throw away a title that is only a channel name', () => {
    expect(splitTitle('Dialogue Media').title).toBe('Dialogue Media')
  })

  it('trims, collapses spaces and shortens very long text', () => {
    expect(splitTitle('  a   b  |  c   d ')).toEqual({ title: 'a b', subtitle: 'c d' })
    expect(splitTitle('x'.repeat(300)).title).toHaveLength(140)
    expect(splitTitle('')).toEqual({ title: '', subtitle: null })
  })
})

describe('parseShortsPage', () => {
  it('lists the Shorts in page order with title, speaker, views and vertical poster', () => {
    const shorts = parseShortsPage(
      page(
        lockup('YOL6PkLUAmo', 'ഇത് സൂഫിസമല്ല ! | ജി.കെ എടത്തനാട്ടുകര | Dialogue centre kerala'),
        lockup('d5CSwPVsAzg', "'പ്രവാചകന്‍മാര്‍ മനുഷ്യരാണ്' | ടി മുഹമ്മദ് വേളം", '784 views'),
      ),
    )
    expect(shorts).toEqual([
      {
        id: 'YOL6PkLUAmo',
        title: 'ഇത് സൂഫിസമല്ല !',
        subtitle: 'ജി.കെ എടത്തനാട്ടുകര',
        views: '2.2K views',
        thumb: 'https://i.ytimg.com/vi/YOL6PkLUAmo/oar2.jpg',
      },
      {
        id: 'd5CSwPVsAzg',
        title: "'പ്രവാചകന്‍മാര്‍ മനുഷ്യരാണ്'",
        subtitle: 'ടി മുഹമ്മദ് വേളം',
        views: '784 views',
        thumb: 'https://i.ytimg.com/vi/d5CSwPVsAzg/oar2.jpg',
      },
    ])
  })

  it('shows each Short once, and skips ones it cannot make sense of', () => {
    const shorts = parseShortsPage(
      page(
        lockup('YOL6PkLUAmo', 'One'),
        lockup('YOL6PkLUAmo', 'One again'),
        lockup('short', 'Bad id'),
        lockup('n_WXyAPhrcY', ''),
        lockup('Wkl0sxNbTwU', 'Two'),
      ),
    )
    expect(shorts.map((s) => s.id)).toEqual(['YOL6PkLUAmo', 'Wkl0sxNbTwU'])
  })

  it('finds the video id from the entity when the tap command is missing', () => {
    const item = {
      shortsLockupViewModel: {
        entityId: 'shorts-shelf-item-Wkl0sxNbTwU',
        overlayMetadata: { primaryText: { content: 'Two' } },
      },
    }
    const [short] = parseShortsPage(page(item))
    expect(short).toMatchObject({ id: 'Wkl0sxNbTwU', views: null })
  })

  it.each([
    ['a page without the data', '<html><body>nothing</body></html>'],
    ['data that is not JSON', '<script>var ytInitialData = {oops;</script>'],
    ['data that is never closed', 'var ytInitialData = {"a":1}'],
    ['a page with no Shorts in it', page({ videoRenderer: {} })],
  ])('gives nothing for %s', (_, html) => expect(parseShortsPage(html)).toEqual([]))
})

describe('the Shorts block in the admin', () => {
  const channel = ShortsBlock.fields.find((f) => 'name' in f && f.name === 'channel') as {
    defaultValue: string
    validate: (v: unknown) => true | string
  }

  it('starts on the Dialogue Media channel', () => {
    expect(channel.defaultValue).toBe('@Dialogue_Media')
    expect(channel.validate(channel.defaultValue)).toBe(true)
  })

  it('only accepts a YouTube channel', () => {
    expect(channel.validate('https://www.youtube.com/@Dialogue_TV')).toBe(true)
    expect(channel.validate('https://example.com/@x')).toMatch(/YouTube channel/)
    expect(channel.validate('')).toMatch(/YouTube channel/)
    expect(channel.validate(42)).toMatch(/YouTube channel/)
  })
})
