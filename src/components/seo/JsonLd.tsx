import { jsonLdHtml } from '@/lib/seo'

/** schema.org structured data for search engines and AI answers. Data only: browsers never run it. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }} />
  )
}
