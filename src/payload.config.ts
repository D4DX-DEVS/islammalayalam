import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import type { CollectionConfig, Field, Plugin } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import { payloadTotp } from 'payload-totp'
import { mfaPolicy } from '@/payload/plugins/mfaPolicy'
import { totpGuard } from '@/payload/plugins/totpGuard'
import { getEnv, spacesConfig } from '@/lib/env'
import { MAX_PDF_BYTES } from '@/lib/media/file-policy'
import { PREVIEW_COLLECTIONS, PREVIEW_GLOBALS, previewTargetFor, previewUrl } from '@/lib/preview'
import { articleEditor } from '@/payload/editor'
import { Authors } from '@/payload/collections/Authors'
import { Categories } from '@/payload/collections/Categories'
import { Media } from '@/payload/collections/Media'
import { Pages } from '@/payload/collections/Pages'
import { Posts } from '@/payload/collections/Posts'
import {
  AuditLogs,
  ContactMessages,
  MigrationIssues,
  MigrationRuns,
  Redirects,
} from '@/payload/collections/system'
import { PostalRequests } from '@/payload/collections/PostalRequests'
import { Audios, Videos } from '@/payload/collections/MediaLinks'
import { Quotes } from '@/payload/collections/Quotes'
import { Users } from '@/payload/collections/Users'
import { globals } from '@/payload/globals'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const env = getEnv()
const SITE_NAME = 'Islam Malayalam'

/** Every admin list: 20 rows by default and a 10/20/50/100 rows-per-page picker. */
const LIST_PAGINATION = { defaultLimit: 20, limits: [10, 20, 50, 100] }
/** Lists that get an "Actions" column (Edit + Delete with confirmation). Logs stay read-only. */
const ROW_ACTIONS = new Set([
  'posts',
  'pages',
  'categories',
  'authors',
  'media',
  'redirects',
  'contact-messages',
  'users',
  'audios',
  'videos',
  'quotes',
])
const rowActionsField: Field = {
  name: 'rowActions',
  type: 'ui',
  label: 'Actions',
  admin: {
    disableBulkEdit: true,
    components: { Cell: '/payload/admin/RowActions#RowActions' },
  },
}
// Admin users are editors, not developers: the API tab and API URL are hidden on every screen.
const HIDE_API = { hideAPIURL: true } as const

const withListDefaults = (collection: CollectionConfig): CollectionConfig => {
  const admin = { pagination: LIST_PAGINATION, ...HIDE_API, ...collection.admin }
  if (!ROW_ACTIONS.has(collection.slug)) return { ...collection, admin }
  return {
    ...collection,
    fields: [...collection.fields, rowActionsField],
    admin: {
      ...admin,
      defaultColumns: admin.defaultColumns && [...admin.defaultColumns, 'rowActions'],
    },
  }
}

/** DigitalOcean Spaces (DO_SPACES_* in .env) — only when fully configured (see src/lib/env.ts). */
function storagePlugins(): Plugin[] {
  const spaces = spacesConfig(env)
  if (!spaces) return []
  const cdn = spaces.cdnUrl
  return [
    s3Storage({
      bucket: spaces.bucket,
      acl: 'public-read',
      config: {
        endpoint: spaces.endpoint,
        region: spaces.region,
        forcePathStyle: false,
        credentials: {
          accessKeyId: spaces.accessKeyId,
          secretAccessKey: spaces.secretAccessKey,
        },
      },
      collections: {
        media: {
          prefix: [spaces.prefix, 'media'].filter(Boolean).join('/'),
          ...(cdn
            ? {
                disablePayloadAccessControl: true,
                generateFileURL: ({ filename: file, prefix }) =>
                  `${cdn}/${[prefix, file].filter(Boolean).join('/')}`,
              }
            : {}),
        },
      },
    }),
  ]
}

export default buildConfig({
  secret: env.PAYLOAD_SECRET,
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
  csrf: [env.NEXT_PUBLIC_SERVER_URL],
  cors: [env.NEXT_PUBLIC_SERVER_URL],
  telemetry: false,
  graphQL: { disable: true },
  defaultDepth: 1,
  maxDepth: 4,
  upload: { limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 50 } },
  admin: {
    user: Users.slug,
    // Payload defaults to Gravatar, which sends a hash of every staff email to a third party.
    avatar: 'default',
    importMap: { baseDir: path.resolve(dirname) },
    meta: {
      titleSuffix: ` — ${SITE_NAME} Admin`,
      robots: 'noindex, nofollow',
      // Replaces Payload's own icons; /favicon.ico is added by app/favicon.ico.
      icons: [
        { rel: 'icon', type: 'image/png', sizes: '192x192', url: '/brand/icon-192.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', url: '/brand/apple-touch-icon.png' },
      ],
    },
    components: {
      graphics: {
        Logo: '/payload/admin/graphics#AdminLogo',
        Icon: '/payload/admin/graphics#AdminIcon',
      },
      Nav: '/payload/admin/nav/AdminNav#AdminNav',
      // Right side of the header: dark-mode switch, then the account dropdown card.
      actions: [
        '/payload/admin/header/ThemeSwitch#ThemeSwitch',
        '/payload/admin/header/AccountMenu#AccountMenu',
      ],
      views: {
        dashboard: { Component: '/payload/admin/dashboard/DashboardView#DashboardView' },
        // Admin → Website manager: every page and section of the site, with where to edit it.
        website: {
          Component: '/payload/admin/website/WebsiteView#WebsiteView',
          path: '/website',
          exact: true,
        },
        // Totals and charts, kept off the Today screen.
        reports: {
          Component: '/payload/admin/dashboard/ReportsView#ReportsView',
          path: '/reports',
          exact: true,
        },
      },
      // Confirmations on Publish/Save/Force Unlock + show/hide on password fields.
      providers: ['/payload/admin/enhancements/AdminEnhancements#AdminEnhancements'],
    },
    // Side-by-side preview while editing. The iframe goes through /next/preview/, which re-checks
    // the staff session (password + TOTP) before showing anything unpublished.
    livePreview: {
      collections: [...PREVIEW_COLLECTIONS],
      globals: [...PREVIEW_GLOBALS],
      breakpoints: [
        { name: 'mobile', label: 'Mobile', width: 375, height: 812 },
        { name: 'tablet', label: 'Tablet', width: 768, height: 1024 },
        { name: 'desktop', label: 'Desktop', width: 1280, height: 900 },
      ],
      url: ({ data, collectionConfig, globalConfig, req }) => {
        const target = previewTargetFor({
          collection: collectionConfig?.slug,
          global: globalConfig?.slug,
          id: data?.id,
        })
        return target ? previewUrl(req.payload.config.serverURL, target) : null
      },
    },
  },
  editor: articleEditor,
  db: mongooseAdapter({ url: env.MONGODB_URI }),
  collections: [
    Posts,
    Pages,
    Categories,
    Authors,
    Quotes,
    Audios,
    Videos,
    Media,
    Redirects,
    ContactMessages,
    PostalRequests,
    Users,
    AuditLogs,
    MigrationRuns,
    MigrationIssues,
  ].map(withListDefaults),
  globals: globals.map((g) => ({ ...g, admin: { ...HIDE_API, ...g.admin } })),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  sharp,
  plugins: [
    seoPlugin({
      collections: ['posts', 'pages', 'categories'],
      globals: ['homepage'],
      uploadsCollection: 'media',
      tabbedUI: false,
      generateTitle: ({ doc }) => (doc?.title ? `${doc.title} | ${SITE_NAME}` : SITE_NAME),
      generateDescription: ({ doc }) =>
        typeof doc?.excerpt === 'string' ? doc.excerpt.slice(0, 160) : '',
    }),
    ...storagePlugins(),
    // Must follow every plugin that adds collections/globals: it wraps the access of everything before it.
    payloadTotp({
      collection: 'users',
      // Hides "remove authenticator" and keeps POST /api/remove-totp refused. Whether setup is
      // actually required comes from Settings → Security, applied by mfaPolicy() below.
      forceSetup: true,
      // mfaPolicy() wraps access instead, following the runtime setting.
      disableAccessWrapper: true,
      disabled: env.TOTP_DISABLED === 'true' && env.NODE_ENV === 'test',
      totp: { issuer: SITE_NAME, algorithm: 'SHA1', digits: 6, period: 30 },
    }),
    // Both must follow payloadTotp(): runtime on/off switch (access + admin redirects), then the
    // attempt limit + replay protection for the code check.
    mfaPolicy(),
    totpGuard(),
  ],
})
