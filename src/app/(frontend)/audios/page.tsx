import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/article/Breadcrumbs'
import { AudioShelf } from '@/components/home/AudioShelf'
import { Container } from '@/components/ui/Container'
import { audioShowLink, getShowFeed } from '@/features/spotify/queries'
import { spotifyShowId } from '@/lib/spotify-show'

export const metadata: Metadata = {
  title: 'Audios',
  description: 'Every episode of the show, with a player.',
  alternates: { canonical: '/audios/' },
}

/** How many of the show's newest episodes the page lists. */
const EPISODES = 50

/**
 * "View More" of the homepage Audios section: the show's own page on this site, with every episode
 * (up to 50) in the same card and player, in a taller card, and a link out to the show on Spotify.
 * When only one episode can be listed there is nothing more to show here, so the visitor goes on
 * to the show's page on Spotify instead.
 */
export default async function AudiosPage() {
  const link = await audioShowLink()
  if (!link || !spotifyShowId(link)) notFound()
  const { show, episodes } = await getShowFeed(link, EPISODES)
  if (episodes.length < 2) redirect(show?.url ?? link)

  return (
    <Container className="py-6 lg:py-10">
      <Breadcrumbs items={[{ label: 'Audios' }]} />
      <AudioShelf
        docs={[]}
        episodes={episodes}
        show={show}
        limit={EPISODES}
        title="Audios"
        more={show?.url ?? link}
        moreExternal
        moreLabel="Open on Spotify"
        half={false}
        fullList
      />
    </Container>
  )
}
