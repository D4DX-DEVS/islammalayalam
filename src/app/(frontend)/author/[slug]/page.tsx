import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { ArchiveHeader } from '@/components/listing/ArchiveHeader'
import { PostListing } from '@/components/listing/PostListing'
import { RichText } from '@/components/richtext/RichText'
import { getAuthorBySlug } from '@/features/categories/queries'
import { listPosts } from '@/features/posts/queries'
import { parsePage } from '@/lib/format'
import { decodeSegment, normalizeSlug } from '@/lib/text/slug'

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function load(props: Props) {
  const decoded = decodeSegment((await props.params).slug)
  const author = decoded ? await getAuthorBySlug(normalizeSlug(decoded)) : null
  if (!author) notFound()
  return { author, page: parsePage((await props.searchParams).page) }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { author, page } = await load(props)
  const canonical = `/author/${author.slug}/`
  return {
    title: author.name,
    alternates: { canonical: page > 1 ? `${canonical}?page=${page}` : canonical },
  }
}

export default async function AuthorPage(props: Props) {
  const { author, page } = await load(props)
  const list = await listPosts({ authorId: author.id, page, limit: 12 })
  if (page > 1 && page > list.totalPages) notFound()
  return (
    <Container className="py-6 lg:py-10">
      <ArchiveHeader
        kicker="ലേഖകൻ"
        title={author.name}
        crumbs={[{ label: author.name }]}
        description={author.bio ? <RichText data={author.bio} className="prose-ml" /> : null}
        count={list.totalDocs}
      />
      <PostListing list={list} basePath={`/author/${author.slug}/`} emptyTitle="ലേഖനങ്ങൾ ഇല്ല" />
    </Container>
  )
}
