import Image from 'next/image'
import { FileDown } from 'lucide-react'
import {
  RichText as LexicalRichText,
  type JSXConvertersFunction,
} from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { isSafeHref, youtubeId } from '@/lib/security/url'
import { categoryHref, pageHref, postHref } from '@/lib/links'
import { mediaSrc } from '@/lib/media'
import type { Category, Media, Page, Post } from '@/payload-types'

/**
 * Lexical → React. Content is never rendered as HTML strings: every node becomes a React element,
 * and links/embeds are re-validated here even though the content guard already checked them on
 * write (defence in depth — audit §13). Unknown node types render nothing.
 */
type LinkFields = {
  linkType?: 'custom' | 'internal'
  url?: string
  newTab?: boolean
  doc?: { relationTo?: string; value?: unknown }
}
type LinkNode = { fields: LinkFields; children: never[] }

function internalHref(doc: LinkFields['doc']): string | null {
  const value = doc?.value
  if (!value || typeof value !== 'object') return null
  if (doc?.relationTo === 'posts') return postHref((value as Post).postNumber)
  if (doc?.relationTo === 'pages') return pageHref((value as Page).path)
  if (doc?.relationTo === 'categories') return categoryHref((value as Category).slug)
  return null
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  return bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function PdfLink({ media, label }: { media: Media; label?: string | null }) {
  const href = mediaSrc(media.url)
  if (!href) return null
  return (
    <a
      href={href}
      download
      className="not-prose group flex items-center gap-4 rounded-card border border-line bg-card p-4 no-underline shadow-card transition-colors hover:border-brand"
    >
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-white">
        <FileDown className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{label || media.filename}</span>
        <span className="text-xs text-muted">PDF · {formatBytes(media.filesize)}</span>
      </span>
    </a>
  )
}

export function YouTubeEmbed({ url, caption }: { url: string; caption?: string | null }) {
  const id = youtubeId(url)
  if (!id) return null
  return (
    <figure>
      <div className="relative aspect-video overflow-hidden rounded-card bg-black shadow-card">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title={caption || 'YouTube video'}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          className="absolute inset-0 size-full"
        />
      </div>
      {caption ? <figcaption className="mt-2 text-sm text-muted">{caption}</figcaption> : null}
    </figure>
  )
}

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  unknown: () => null,
  link: ({ node, nodesToJSX }) => {
    const { fields, children } = node as unknown as LinkNode
    const href =
      fields.linkType === 'internal'
        ? internalHref(fields.doc)
        : isSafeHref(fields.url)
          ? fields.url!
          : null
    const content = nodesToJSX({ nodes: children })
    if (!href) return <span>{content}</span>
    const external = /^https?:\/\//.test(href)
    return (
      <a
        href={href}
        target={fields.newTab ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
      >
        {content}
      </a>
    )
  },
  autolink: ({ node, nodesToJSX }) => {
    const { fields, children } = node as unknown as LinkNode
    const content = nodesToJSX({ nodes: children })
    return isSafeHref(fields.url) ? (
      <a href={fields.url} rel="noopener noreferrer">
        {content}
      </a>
    ) : (
      <span>{content}</span>
    )
  },
  upload: ({ node }) => {
    const media = (node as { value?: unknown }).value
    if (!media || typeof media !== 'object') return null
    const m = media as Media
    if (m.mimeType === 'application/pdf') return <PdfLink media={m} />
    const src = mediaSrc(m.sizes?.large?.url ?? m.url)
    if (!src || !m.width || !m.height) return null
    return (
      <figure>
        <Image
          src={src}
          alt={m.alt ?? ''}
          width={m.width}
          height={m.height}
          sizes="(min-width: 768px) 720px, 100vw"
          className="h-auto w-full rounded-card"
        />
        {m.caption ? (
          <figcaption className="mt-2 text-sm text-muted">{m.caption}</figcaption>
        ) : null}
      </figure>
    )
  },
  blocks: {
    youtube: ({ node }: { node: { fields: { url?: string; caption?: string } } }) =>
      node.fields.url ? <YouTubeEmbed url={node.fields.url} caption={node.fields.caption} /> : null,
    pdfAttachment: ({ node }: { node: { fields: { file?: unknown; label?: string } } }) =>
      node.fields.file && typeof node.fields.file === 'object' ? (
        <PdfLink media={node.fields.file as Media} label={node.fields.label} />
      ) : null,
  },
})

interface RichTextProps {
  data: unknown
  className?: string
}

export function RichText({ data, className = 'prose-ml' }: RichTextProps) {
  if (!data || typeof data !== 'object' || !('root' in data)) return null
  return (
    <LexicalRichText
      data={data as SerializedEditorState}
      converters={converters}
      className={className}
      disableContainer={false}
    />
  )
}
