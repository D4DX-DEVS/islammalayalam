import {
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { richTextBlocks } from '@/payload/blocks/richtext'

/**
 * Deliberately small editor: every feature here must map to a node type allowed by
 * src/lib/security/lexical-guard.ts. No raw HTML/embed/code features exist, so there is no path
 * for script or markup to reach the frontend (audit: injected <script>/iframes in post bodies).
 */
export const articleEditor = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    StrikethroughFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    LinkFeature({ enabledCollections: ['posts', 'pages', 'categories'], maxDepth: 1 }),
    UploadFeature({ enabledCollections: ['media'], maxDepth: 1 }),
    HorizontalRuleFeature(),
    BlocksFeature({ blocks: richTextBlocks }),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
})

/** Short intros/notes: formatting and links only. */
export const simpleEditor = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    LinkFeature({ enabledCollections: ['posts', 'pages', 'categories'], maxDepth: 1 }),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
})
