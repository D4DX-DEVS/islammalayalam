import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { PostArticle } from '@/components/article/PostArticle'
import { KbPage } from '@/components/page/KbPage'
import { resolvePath } from '@/features/routing/resolve'
import { getSiteSettings } from '@/features/site/queries'
import { mediaSrc } from '@/lib/media'
import { pageHref, postHref } from '@/lib/links'
import type { Media } from '@/payload-types'

type Props = { params: Promise<{ path: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await resolvePath((await params).path)
  if (res.kind === 'post') {
    const { post } = res
    const image =
      (post.meta?.image && typeof post.meta.image === 'object' ? post.meta.image : null) ??
      (typeof post.featuredImage === 'object' ? post.featuredImage : null)
    const ogImage = mediaSrc(
      (image as Media | null)?.sizes?.large?.url ?? (image as Media | null)?.url,
    )
    return {
      title: post.meta?.title || post.title,
      description: post.meta?.description || post.excerpt || undefined,
      alternates: { canonical: postHref(post.postNumber) },
      openGraph: {
        type: 'article',
        title: post.title,
        publishedTime: post.publishedAt ?? undefined,
        images: ogImage ? [ogImage] : undefined,
      },
    }
  }
  if (res.kind === 'page') {
    return {
      title: res.page.meta?.title || res.page.title,
      description: res.page.meta?.description || undefined,
      alternates: { canonical: pageHref(res.page.path) },
    }
  }
  return {}
}

/** Everything not matched by a specific route: /<post number>/, KB page paths, legacy URLs. */
export default async function CatchAllPage({ params }: Props) {
  const res = await resolvePath((await params).path)
  if (res.kind !== 'post' && res.kind !== 'page') notFound() // already handled with real statuses in layout.tsx

  const settings = await getSiteSettings()
  return (
    <Container className="py-6 lg:py-10">
      {res.kind === 'post' ? (
        <PostArticle post={res.post} siteName={settings.siteName} />
      ) : (
        <KbPage page={res.page} />
      )}
    </Container>
  )
}
