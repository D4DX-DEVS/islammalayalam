import {
  AlignFeature,
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  ChecklistFeature,
  EXPERIMENTAL_TableFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  IndentFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import type { FieldHook } from 'payload'
import { withoutEmptyRoot } from '@/lib/text/lexical'
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
    SubscriptFeature(),
    SuperscriptFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
    AlignFeature(),
    IndentFeature(),
    UnorderedListFeature(),
    OrderedListFeature(),
    ChecklistFeature(),
    BlockquoteFeature(),
    LinkFeature({ enabledCollections: ['posts', 'pages', 'categories'], maxDepth: 1 }),
    UploadFeature({ enabledCollections: ['media'], maxDepth: 1 }),
    HorizontalRuleFeature(),
    EXPERIMENTAL_TableFeature(),
    BlocksFeature({ blocks: richTextBlocks }),
    // Picture, table and line as visible buttons, not hidden behind "+".
    FixedToolbarFeature({ customGroups: { add: { type: 'buttons' } } }),
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

/**
 * Imported posts with no body were stored as a root with no children, which the editor refuses to
 * open ("Minified Lexical error #38"). Such a value is read and saved as "no content" instead.
 */
const emptyRootToNull: FieldHook = ({ value }) => withoutEmptyRoot(value)
export const richTextHooks = { afterRead: [emptyRootToNull], beforeChange: [emptyRootToNull] }
