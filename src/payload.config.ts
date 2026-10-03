import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import type { Plugin } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { s3Storage } from '@payloadcms/storage-s3'
import sharp from 'sharp'
import { payloadTotp } from 'payload-totp'
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
import { Users } from '@/payload/collections/Users'
import { globals } from '@/payload/globals'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const env = getEnv()
const SITE_NAME = 'Islam Malayalam'

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
      beforeDashboard: ['/payload/admin/Dashboard#EditorialDashboard'],
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
    Media,
    Redirects,
    ContactMessages,
    Users,
    AuditLogs,
    MigrationRuns,
    MigrationIssues,
  ],
  globals,
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
      forceSetup: true,
      disabled: env.TOTP_DISABLED === 'true' && env.NODE_ENV === 'test',
      totp: { issuer: SITE_NAME, algorithm: 'SHA1', digits: 6, period: 30 },
    }),
    // Attempt limit + replay protection for payload-totp's code check; must follow payloadTotp().
    totpGuard(),
  ],
})
