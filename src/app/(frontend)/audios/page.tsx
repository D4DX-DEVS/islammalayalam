import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs } from '@/components/article/Breadcrumbs'
import { AudioShelf } from '@/components/home/AudioShelf'
import { Container } from '@/components/ui/Container'
import { listAudioEntries } from '@/features/media-items/queries'
import { listPosts } from '@/features/posts/queries'
import { audioShowLink, getShowFeed } from '@/features/spotify/queries'

export const metadata: Metadata = {
  title: 'Audios',
  description: 'Every episode of the show, with a player.',
  alternates: { canonical: '/audios/' },
}

/** How many of the show's newest episodes (and of the entries and posts) the page lists. */
const EPISODES = 50

/**
 * The Audios page (mobile dock, and "View More" of the homepage Audios section): the quick entries
 * added in the admin, the Spotify show's episodes and the Audio posts, in the same card and player
 * as the homepage, in a taller card. It always stays on this site — even when Spotify only gives
 * the show's newest episode (no Spotify app set up), that one is played here, with a link out to
 * the show on Spotify.
 */
export default async function AudiosPage() {
  const link = await audioShowLink()
  const [{ show, episodes }, entries, { docs }] = await Promise.all([
    getShowFeed(link, EPISODES),
    listAudioEntries(EPISODES),
    listPosts({ format: 'audio', limit: EPISODES }),
  ])
  if (!episodes.length && !entries.length && !docs.length) notFound()
  const spotify = show?.url ?? link

  return (
    <Container className="py-6 lg:py-10">
      <Breadcrumbs items={[{ label: 'Audios' }]} />
      <AudioShelf
        docs={docs}
        entries={entries}
        episodes={episodes}
        show={show}
        limit={EPISODES}
        title="Audios"
        more={spotify}
        moreExternal={Boolean(spotify)}
        moreLabel={spotify ? 'Open on Spotify' : undefined}
        half={false}
        fullList
      />
    </Container>
  )
}
