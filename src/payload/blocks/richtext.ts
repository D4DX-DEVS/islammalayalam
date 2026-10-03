import type { Block, TextFieldSingleValidation } from 'payload'
import { youtubeId } from '@/lib/security/url'

/**
 * Blocks allowed INSIDE rich text. Slugs must match RICH_TEXT_BLOCKS in hooks/contentGuard.ts —
 * the guard rejects any other block type, whatever the admin UI allows.
 */
const validateYoutube: TextFieldSingleValidation = (value) =>
  value && youtubeId(value)
    ? true
    : 'Enter a YouTube link (youtube.com/watch?v=…, youtu.be/…, /shorts/…)'

export const YouTubeBlock: Block = {
  slug: 'youtube',
  interfaceName: 'YouTubeBlock',
  labels: { singular: 'YouTube video', plural: 'YouTube videos' },
  fields: [
    { name: 'url', type: 'text', required: true, validate: validateYoutube },
    { name: 'caption', type: 'text', maxLength: 200 },
  ],
}

export const PdfAttachmentBlock: Block = {
  slug: 'pdfAttachment',
  interfaceName: 'PdfAttachmentBlock',
  labels: { singular: 'PDF download', plural: 'PDF downloads' },
  fields: [
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { equals: 'application/pdf' } },
    },
    { name: 'label', type: 'text', maxLength: 160 },
  ],
}

export const richTextBlocks: Block[] = [YouTubeBlock, PdfAttachmentBlock]
