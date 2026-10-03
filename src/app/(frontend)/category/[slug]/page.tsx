import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { ArchiveHeader } from '@/components/listing/ArchiveHeader'
import { PostListing } from '@/components/listing/PostListing'
import { getCategoryBySlug } from '@/features/categories/queries'
import { listPosts } from '@/features/posts/queries'
import { encodePath } from '@/features/routing/resolve'
import { parsePage } from '@/lib/format'
import { categoryHref } from '@/lib/links'
import { decodeSegment, normalizeSlug } from '@/lib/text/slug'

const PAGE_SIZE = 12
type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function load(props: Props) {
  const { slug: raw } = await props.params
  const decoded = decodeSegment(raw)
  const slug = decoded ? normalizeSlug(decoded) : ''
  if (!slug) notFound()
  const category = await getCategoryBySlug(slug)
  if (!category) notFound()
  if (decoded !== slug) permanentRedirect(encodePath(categoryHref(slug)!))
  const page = parsePage((await props.searchParams).page)
  return { category, page }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { category, page } = await load(props)
  const canonical = categoryHref(category.slug)!
  return {
    title: page > 1 ? `${category.name} — പേജ് ${page}` : category.name,
    description: category.description ?? undefined,
    alternates: { canonical: page > 1 ? `${canonical}?page=${page}` : canonical },
  }
}

export default async function CategoryPage(props: Props) {
  const { category, page } = await load(props)
  const list = await listPosts({ categoryId: category.id, page, limit: PAGE_SIZE })
  if (page > 1 && page > list.totalPages) notFound()
  return (
    <Container className="py-6 lg:py-10">
      <ArchiveHeader
        kicker="വിഭാഗം"
        title={category.name}
        crumbs={[{ label: category.name }]}
        description={category.description}
        count={list.totalDocs}
      />
      <PostListing
        list={list}
        basePath={categoryHref(category.slug)!}
        emptyTitle="ഈ വിഭാഗത്തിൽ ലേഖനങ്ങൾ ഇല്ല"
        hideCategory
      />
    </Container>
  )
}
