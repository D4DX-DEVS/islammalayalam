import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  TextFieldSingleValidation,
} from 'payload'
import { isEditor, publicActiveOrStaff, totpPublicRead } from '@/payload/access'
import { validateOptionalHttps, validateYouTubeLink } from '@/payload/fields'
import { contentHooks } from '@/payload/hooks'
import { itemLabel, type MediaKind } from '@/lib/media-items'

/**
 * Quick audio and video entries: a link, a title and an author — every one optional — added in
 * seconds from the admin dashboard (or here). They feed the homepage Audios player and Videos
 * band, newest first, next to the Audio / Video posts. An entry with no usable link is kept in the
 * admin but not shown on the site.
 */
function mediaLinks(config: {
  slug: string
  kind: MediaKind
  singular: string
  plural: string
  validateLink: TextFieldSingleValidation
  linkHelp: string
  siteHelp: string
}): CollectionConfig {
  const setLabel: CollectionBeforeChangeHook = ({ data }) => ({
    ...data,
    label: itemLabel(data ?? {}, config.kind),
  })
  return {
    slug: config.slug,
    labels: { singular: config.singular, plural: config.plural },
    admin: {
      useAsTitle: 'label',
      group: 'Content',
      defaultColumns: ['label', 'author', 'link', 'active', 'createdAt'],
      listSearchableFields: ['label', 'title', 'author', 'link'],
      description: config.siteHelp,
    },
    custom: totpPublicRead,
    defaultSort: '-createdAt',
    access: { read: publicActiveOrStaff, create: isEditor, update: isEditor, delete: isEditor },
    hooks: contentHooks({ beforeChange: [setLabel] }),
    fields: [
      { name: 'label', type: 'text', admin: { hidden: true } },
      {
        name: 'link',
        type: 'text',
        maxLength: 500,
        validate: config.validateLink,
        admin: { description: config.linkHelp },
      },
      {
        name: 'title',
        type: 'text',
        maxLength: 200,
        admin: {
          description: 'Optional. Left empty, the site uses the title the link itself reports.',
        },
      },
      {
        name: 'author',
        type: 'text',
        maxLength: 120,
        admin: { description: 'Optional. Speaker, channel or presenter.' },
      },
      {
        name: 'active',
        type: 'checkbox',
        defaultValue: true,
        admin: {
          position: 'sidebar',
          description: 'Untick to hide it from the site without deleting it.',
        },
      },
    ],
  }
}

export const Audios = mediaLinks({
  slug: 'audios',
  kind: 'audio',
  singular: 'Audio',
  plural: 'Audios',
  validateLink: validateOptionalHttps,
  linkHelp:
    'Optional. A Spotify link (episode, show or playlist — it plays inside the player) or a direct https link to an audio file.',
  siteHelp:
    'Quick audio entries for the homepage Audios player: just a link, a title and an author — all optional. Newest first.',
})

export const Videos = mediaLinks({
  slug: 'videos',
  kind: 'video',
  singular: 'Video',
  plural: 'Videos',
  validateLink: validateYouTubeLink,
  linkHelp: 'Optional. A YouTube link. The video opens in a popup player on the homepage.',
  siteHelp:
    'Quick video entries for the homepage Videos band: just a link, a title and an author — all optional. Newest first.',
})
