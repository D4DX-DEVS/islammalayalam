import type { CollectionConfig, Field } from 'payload'
import { isAdmin, isEditor, nobody } from '@/payload/access'
import { contentHooks } from '@/payload/hooks'
import { GENDERS, LIMITS, ORG_ANSWERS, STATUSES } from '@/features/postal/constants'

/**
 * Membership requests from the "‘കിം’ പോസ്റ്റല്‍ ലൈബ്രറി" form. Created only by the site's server
 * action (Local API: validated, honeypot, rate-limited), never through the REST API. Staff read them
 * under Submissions and move them along with `status` and `notes`; what the reader wrote is locked.
 */
const locked = { update: () => false }

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  new: 'New',
  'in-progress': 'In progress',
  member: 'Member enrolled',
  closed: 'Closed',
  spam: 'Spam',
}

const answer = (name: string, label: string): Field => ({
  name,
  label,
  type: 'textarea',
  required: true,
  maxLength: LIMITS.answer,
  access: locked,
})

export const PostalRequests: CollectionConfig = {
  slug: 'postal-requests',
  labels: { singular: 'Postal library request', plural: 'Postal library requests' },
  admin: {
    useAsTitle: 'name',
    group: 'Submissions',
    defaultColumns: ['name', 'phone', 'email', 'status', 'createdAt'],
    listSearchableFields: ['name', 'phone', 'email', 'pincode'],
    description: 'Requests to join the postal library. Readers cannot be edited, only triaged.',
  },
  defaultSort: '-createdAt',
  access: { read: isEditor, create: nobody, update: isEditor, delete: isAdmin },
  hooks: contentHooks(),
  fields: [
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      required: true,
      index: true,
      options: STATUSES.map((value) => ({ label: STATUS_LABEL[value], value })),
      admin: { position: 'sidebar' },
    },
    {
      name: 'notes',
      type: 'textarea',
      maxLength: 2000,
      admin: {
        position: 'sidebar',
        description: 'Internal. For example the ledger number or which books were sent.',
      },
    },
    { name: 'name', type: 'text', required: true, maxLength: LIMITS.name, access: locked },
    { name: 'age', type: 'number', required: true, min: 5, max: 120, access: locked },
    {
      name: 'gender',
      type: 'select',
      required: true,
      options: [
        { label: 'Male', value: GENDERS[0] },
        { label: 'Female', value: GENDERS[1] },
      ],
      access: locked,
    },
    {
      name: 'address',
      type: 'textarea',
      required: true,
      maxLength: LIMITS.address,
      access: locked,
    },
    { name: 'pincode', type: 'text', required: true, maxLength: 12, access: locked },
    { name: 'phone', type: 'text', required: true, maxLength: 24, access: locked },
    { name: 'email', type: 'email', required: true, access: locked },
    {
      name: 'education',
      type: 'text',
      required: true,
      maxLength: LIMITS.education,
      access: locked,
    },
    { name: 'religion', type: 'text', required: true, maxLength: LIMITS.religion, access: locked },
    {
      name: 'orgMember',
      label: 'Member of an organisation or political movement?',
      type: 'select',
      options: [
        { label: 'Yes', value: ORG_ANSWERS[0] },
        { label: 'No', value: ORG_ANSWERS[1] },
      ],
      access: locked,
    },
    answer('readBefore', 'Has read about Islam before? Where, what?'),
    answer('difficulties', 'Aspects of Islam they cannot accept or agree with'),
    answer('favouriteAspect', 'Aspect of Islam they like most'),
    answer('wantsToLearn', 'Aspect of Islam they most want to learn about'),
  ],
}
