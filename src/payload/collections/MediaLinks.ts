import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  TextFieldSingleValidation,
} from 'payload'
import { isEditor, publicActiveOrStaff, totpPublicRead } from '@/payload/access'
import { validateOptionalHttps, validateYouTubeLink } from '@/payload/fields'
import { contentHooks } from '@/payload/hooks'
import { labelFor, type MediaKind } from '@/lib/media-items'

/**
 * Quick audio and video entries: a link, a title and an author — every one optional — added in
 * seconds from the admin dashboard (or here). They feed the homepage Audios player and Videos
 * band, in the order set in the admin list (drag a row or use its arrows; new entries start at the
 * top), next to the Audio / Video posts. An entry with no usable link is kept in the admin but not
 * shown on the site.
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
  const setLabel: CollectionBeforeChangeHook = ({ data, originalDoc }) => ({
    ...data,
    label: labelFor(data ?? {}, originalDoc, config.kind),
  })
  return {
    slug: config.slug,
    labels: { singular: config.singular, plural: config.plural },
    admin: {
      useAsTitle: 'label',
      group: 'Library',
      defaultColumns: ['moveArrows', 'label', 'author', 'link', 'active', 'createdAt'],
      listSearchableFields: ['label', 'title', 'author', 'link'],
      description: config.siteHelp,
      components: {
        beforeListTable: ['/payload/admin/media/ListOrderHint#ListOrderHint'],
        edit: { SaveButton: '/payload/admin/media/SaveButtons#SaveButtons' },
      },
    },
    custom: totpPublicRead,
    // Position = order on the site. Drag handles come from `orderable`; the top row is shown first.
    orderable: true,
    defaultSort: '-_order',
    access: { read: publicActiveOrStaff, create: isEditor, update: isEditor, delete: isEditor },
    hooks: contentHooks({ beforeChange: [setLabel] }),
    fields: [
      {
        name: 'moveArrows',
        type: 'ui',
        label: 'Move',
        admin: {
          disableBulkEdit: true,
          components: { Cell: '/payload/admin/media/MoveArrows#MoveArrows' },
        },
      },
      { name: 'label', type: 'text', label: 'Name', admin: { hidden: true } },
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
  plural: 'Audio',
  validateLink: validateOptionalHttps,
  linkHelp:
    'Optional. A Spotify link (episode, show or playlist — it plays inside the player) or a direct https link to an audio file. A Spotify episode link is listed with its picture, date and length, and its title when you leave the title empty.',
  siteHelp:
    'Quick audio entries for the homepage Audios player: just a link, a title and an author — all optional. Drag the rows (or use the arrows) to set the order they show in on the site; the top one comes first.',
})

export const Videos = mediaLinks({
  slug: 'videos',
  kind: 'video',
  singular: 'Video',
  plural: 'Videos',
  validateLink: validateYouTubeLink,
  linkHelp: 'Optional. A YouTube link. The video opens in a popup player on the homepage.',
  siteHelp:
    'Quick video entries for the homepage Videos band: just a link, a title and an author — all optional. Drag the rows (or use the arrows) to set the order they show in on the site; the top one comes first.',
})
