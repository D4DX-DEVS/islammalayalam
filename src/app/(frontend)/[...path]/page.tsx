import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/Container'
import { PostArticle } from '@/components/article/PostArticle'
import { KbPage } from '@/components/page/KbPage'
import { PostalLibraryPage } from '@/components/postal/PostalLibraryPage'
import { resolvePath } from '@/features/routing/resolve'
import { getSiteSettings } from '@/features/site/queries'
import { shareImage } from '@/lib/media'
import { postDescription } from '@/lib/seo'
import { pageHref, postHref } from '@/lib/links'

type Props = { params: Promise<{ path: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await resolvePath((await params).path)
  if (res.kind === 'post') {
    const { post } = res
    const settings = await getSiteSettings()
    const href = postHref(post.postNumber)
    const description = postDescription(post)
    const image =
      (post.meta?.image && typeof post.meta.image === 'object' ? post.meta.image : null) ??
      (typeof post.featuredImage === 'object' ? post.featuredImage : null) ??
      settings.defaultOgImage
    return {
      title: post.meta?.title || post.title,
      description,
      alternates: { canonical: href },
      openGraph: {
        type: 'article',
        siteName: settings.siteName,
        locale: 'ml_IN',
        url: href ?? undefined,
        title: post.title,
        description,
        publishedTime: post.publishedAt ?? undefined,
        modifiedTime: post.updatedAt,
        images: [shareImage(image)],
      },
    }
  }
  if (res.kind === 'page') {
    const settings = await getSiteSettings()
    const href = pageHref(res.page.path)
    const description = postDescription(res.page)
    return {
      title: res.page.meta?.title || res.page.title,
      description,
      alternates: { canonical: href },
      openGraph: {
        type: 'website',
        siteName: settings.siteName,
        locale: 'ml_IN',
        url: href ?? undefined,
        title: res.page.title,
        description,
        images: [
          shareImage(res.page.meta?.image || res.page.featuredImage || settings.defaultOgImage),
        ],
      },
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
    <Container className="py-4 lg:py-6">
      {res.kind === 'post' ? (
        <PostArticle post={res.post} siteName={settings.siteName} />
      ) : res.page.template === 'postal-request' ? (
        <PostalLibraryPage page={res.page} />
      ) : (
        <KbPage page={res.page} />
      )}
    </Container>
  )
}
