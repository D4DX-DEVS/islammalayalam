import type { CollectionConfig, FieldHook, TextFieldSingleValidation } from 'payload'
import { isAdmin, isEditor, nobody } from '@/payload/access'
import { contentHooks } from '@/payload/hooks'
import { AUDIT_ACTIONS } from '@/payload/hooks/auditLog'
import { normalizePath, toPath } from '@/lib/text/slug'

/**
 * Non-content collections: redirects (SEO), inbound contact messages, the append-only audit log,
 * and migration bookkeeping. None of these are readable anonymously.
 */
const validatePathOrUrl: TextFieldSingleValidation = (value) => {
  if (!value) return 'Required'
  if (value.startsWith('/') && !value.startsWith('//'))
    return value.length <= 2000 ? true : 'Too long'
  return /^https:\/\/[^\s]+$/.test(value) ? true : 'Use a site path (/…) or an https:// URL'
}

/** Store `from` in the same canonical form the router looks up: decoded, NFC, chillu-normalised, trailing slash. */
const canonicalFrom: FieldHook = ({ value }) => {
  if (typeof value !== 'string') return value
  const segments = normalizePath(value.split(/[?#]/)[0] ?? '')
  return segments ? toPath(segments) : value
}

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'from',
    group: 'Admin',
    defaultColumns: ['from', 'to', 'code', 'source', 'hits'],
  },
  access: { read: isEditor, create: isEditor, update: isEditor, delete: isEditor },
  hooks: contentHooks(),
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Old path, e.g. /some-old-slug/ (stored decoded, NFC)' },
      hooks: { beforeValidate: [canonicalFrom] },
      validate: ((v) =>
        v && v.startsWith('/') && !v.startsWith('//')
          ? true
          : 'Must be a site path starting with /') as TextFieldSingleValidation,
    },
    {
      name: 'to',
      type: 'text',
      validate: validatePathOrUrl,
      admin: { condition: (_, s) => s?.code !== '410' },
    },
    {
      name: 'code',
      type: 'select',
      required: true,
      defaultValue: '301',
      options: [
        { label: '301 Moved permanently', value: '301' },
        { label: '308 Permanent (keep method)', value: '308' },
        { label: '410 Gone', value: '410' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      options: ['manual', 'auto', 'migration'],
      admin: { readOnly: true },
    },
    {
      name: 'hits',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
  ],
}

export const ContactMessages: CollectionConfig = {
  slug: 'contact-messages',
  admin: {
    useAsTitle: 'subject',
    group: 'Admin',
    defaultColumns: ['name', 'subject', 'status', 'createdAt'],
  },
  // Created only by the site's server action (Local API, rate-limited); never via the REST API.
  access: { read: isEditor, create: nobody, update: isEditor, delete: isAdmin },
  hooks: contentHooks(),
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120, access: { update: () => false } },
    { name: 'email', type: 'email', required: true, access: { update: () => false } },
    { name: 'subject', type: 'text', maxLength: 200, access: { update: () => false } },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      maxLength: 5000,
      access: { update: () => false },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: ['new', 'read', 'replied', 'spam'],
      admin: { position: 'sidebar' },
    },
  ],
}

export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'target',
    group: 'Admin',
    defaultColumns: ['createdAt', 'action', 'target', 'docId', 'user'],
  },
  defaultSort: '-createdAt',
  access: { read: isAdmin, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: 'action', type: 'select', required: true, index: true, options: [...AUDIT_ACTIONS] },
    { name: 'target', type: 'text', required: true, index: true },
    { name: 'docId', type: 'text', index: true },
    { name: 'changed', type: 'text' },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    {
      name: 'actor',
      type: 'text',
      admin: { description: 'Non-user actor, e.g. migration run id' },
    },
    { name: 'ip', type: 'text' },
  ],
}

export const MigrationRuns: CollectionConfig = {
  slug: 'migration-runs',
  admin: {
    useAsTitle: 'runId',
    group: 'Migration',
    defaultColumns: ['runId', 'status', 'startedAt', 'finishedAt'],
  },
  access: { read: isAdmin, create: nobody, update: nobody, delete: isAdmin },
  fields: [
    { name: 'runId', type: 'text', required: true, unique: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: ['running', 'completed', 'failed', 'aborted'],
    },
    { name: 'dryRun', type: 'checkbox', defaultValue: true },
    { name: 'startedAt', type: 'date' },
    { name: 'finishedAt', type: 'date' },
    // textarea (JSON text), not `json`: the admin's JSON editor loads Monaco from a third-party CDN, which the admin CSP forbids.
    {
      name: 'counts',
      type: 'textarea',
      admin: {
        readOnly: true,
        description: 'Per-entity source / migrated / quarantined / rejected counts (JSON)',
      },
    },
    { name: 'notes', type: 'textarea' },
  ],
}

export const MigrationIssues: CollectionConfig = {
  slug: 'migration-issues',
  admin: {
    useAsTitle: 'summary',
    group: 'Migration',
    defaultColumns: ['severity', 'entity', 'wpId', 'gate', 'resolved'],
  },
  access: { read: isAdmin, create: nobody, update: isAdmin, delete: isAdmin },
  fields: [
    { name: 'run', type: 'relationship', relationTo: 'migration-runs', index: true },
    {
      name: 'entity',
      type: 'select',
      required: true,
      options: ['post', 'page', 'category', 'author', 'media', 'menu', 'redirect'],
    },
    { name: 'wpId', type: 'number', index: true },
    {
      name: 'gate',
      type: 'select',
      required: true,
      options: ['A-source', 'B-media', 'C-content', 'validation'],
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      options: ['quarantined', 'rejected', 'warning'],
    },
    { name: 'summary', type: 'text', required: true, maxLength: 300 },
    {
      name: 'details',
      type: 'textarea',
      maxLength: 20000,
      admin: { readOnly: true, description: 'Defanged evidence only — never raw payloads (JSON)' },
    },
    { name: 'resolved', type: 'checkbox', defaultValue: false, index: true },
  ],
}
