import type { ReactNode } from 'react'
import { Mail, MapPin, Phone, type LucideIcon } from 'lucide-react'
import type { SiteSetting } from '@/payload-types'

type Contact = NonNullable<SiteSetting['contact']>

const TONES = {
  /** On the royal-blue footer. */
  dark: {
    chip: 'size-9 rounded-xl bg-white/10 ring-1 ring-white/10',
    icon: 'text-sky-300',
    text: 'text-white/75',
    link: 'hover:text-white',
    label: 'text-white/50',
  },
  /** On a white panel. */
  light: {
    chip: 'size-10 rounded-2xl bg-brand-soft',
    icon: 'text-brand',
    text: 'text-body',
    link: 'font-medium hover:text-brand',
    label: 'text-muted',
  },
} as const

/** A contact number as a `tel:` address (digits and a leading +). */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`

/** The email addresses to list: the first and, when there is one, the second (never the same twice). */
export const emailsOf = (contact: Contact | null | undefined): string[] =>
  [contact?.email, contact?.secondEmail]
    .map((e) => (e ?? '').trim())
    .filter((e, i, all) => e && all.indexOf(e) === i)

/**
 * The contact details from Site settings — address, phone, emails — with an icon each. Used in the
 * footer, the Quick Contact block and beside the About page, so they never differ. `labels` puts a
 * small caption (Address / Phone / Email) over each.
 */
export function ContactDetails({
  contact,
  tone = 'light',
  labels = false,
  className = '',
}: {
  contact: Contact | null | undefined
  tone?: keyof typeof TONES
  labels?: boolean
  className?: string
}) {
  const t = TONES[tone]
  const emails = emailsOf(contact)
  const row = (icon: LucideIcon, label: string, content: ReactNode) => {
    const Icon = icon
    return (
      <div className="flex gap-3">
        <span className={`inline-flex shrink-0 items-center justify-center ${t.chip}`}>
          <Icon className={`size-4 shrink-0 ${t.icon}`} aria-hidden="true" />
        </span>
        <div className={`flex min-h-9 min-w-0 flex-col justify-center ${t.text}`}>
          {labels ? (
            <span className={`text-xs font-semibold uppercase tracking-wide ${t.label}`}>
              {label}
            </span>
          ) : null}
          {content}
        </div>
      </div>
    )
  }
  return (
    <address className={`space-y-3 text-sm not-italic ${className}`}>
      {contact?.address
        ? row(MapPin, 'Address', <span className="whitespace-pre-line">{contact.address}</span>)
        : null}
      {contact?.phone
        ? row(
            Phone,
            'Phone',
            <a href={telHref(contact.phone)} className={t.link}>
              {contact.phone}
            </a>,
          )
        : null}
      {emails.length
        ? row(
            Mail,
            emails.length > 1 ? 'Emails' : 'Email',
            emails.map((email) => (
              <a key={email} href={`mailto:${email}`} className={`break-all ${t.link}`}>
                {email}
              </a>
            )),
          )
        : null}
    </address>
  )
}
