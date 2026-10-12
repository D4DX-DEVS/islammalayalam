import Link from 'next/link'
import type { Payload, SanitizedPermissions } from 'payload'
import {
  Activity,
  ExternalLink,
  FilePen,
  FilePlus2,
  FileText,
  Flag,
  FolderTree,
  ImageUp,
  Images,
  Inbox,
  LayoutTemplate,
  Menu,
  Newspaper,
  PanelBottom,
  Plus,
  Send,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { loadDashboard, type DashboardData } from '../dashboardData'
import { ActivityRows, CategoryBars, MessageRows, Panel, PostRows } from './parts'

/**
 * Replaces Payload's dashboard (admin.components.views.dashboard): editorial overview with totals,
 * recent work, inbox, categories and the audit trail. Everything is loaded as the signed-in user
 * (dashboardData.ts) and every link/panel is filtered by that user's permissions.
 */
type Props = {
  payload: Payload
  permissions?: SanitizedPermissions
  user?:
    | ({ id: string | number; name?: string | null; email?: string; role?: string | null } & Record<
        string,
        unknown
      >)
    | null
}

type Shortcut = { label: string; hint: string; href: string; icon: LucideIcon; allowed: boolean }

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', editor: 'Editor', author: 'Author' }
const TZ = 'Asia/Kolkata'

function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', timeZone: TZ }).format(now),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export async function DashboardView({ payload, permissions, user }: Props) {
  if (!user) return null
  let data: DashboardData
  try {
    data = await loadDashboard(payload, user)
  } catch (err) {
    payload.logger.warn({ err }, 'Dashboard could not load')
    return (
      <div className="im-dash im-dash--view">
        <p className="im-dash__empty">The dashboard could not load. Reload the page to retry.</p>
      </div>
    )
  }

  const admin = payload.config.routes.admin
  const col = (slug: string) => `${admin}/collections/${slug}`
  const can = permissions ?? {}
  const canRead = (slug: string) => Boolean(can.collections?.[slug]?.read)
  const posts = col('posts')
  const draftsHref = `${posts}?where[_status][equals]=draft`
  const reviewHref = `${posts}?where[flags.needsReview][equals]=true`
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(now)
  const name = user.name || user.email?.split('@')[0] || 'there'

  const stats = [
    { label: 'Published posts', value: data.stats.published, icon: Newspaper, href: posts },
    {
      label: data.ownDraftsOnly ? 'Your drafts' : 'Drafts',
      value: data.stats.drafts,
      icon: FilePen,
      href: draftsHref,
    },
    { label: 'Needs review', value: data.stats.needsReview, icon: Flag, href: reviewHref },
    { label: 'Pages', value: data.stats.pages, icon: FileText, href: col('pages') },
    { label: 'Media files', value: data.stats.media, icon: Images, href: col('media') },
    {
      label: 'New messages',
      value: data.stats.newMessages,
      icon: Inbox,
      href: `${col('contact-messages')}?where[status][equals]=new`,
      hidden: !canRead('contact-messages'),
    },
  ].filter((s) => !s.hidden)

  const shortcuts: Shortcut[] = [
    {
      label: 'New page',
      hint: 'Static page or KB section',
      href: `${col('pages')}/create`,
      icon: FileText,
      allowed: Boolean(can.collections?.pages?.create),
    },
    {
      label: 'Upload media',
      hint: 'Images, audio, PDF',
      href: `${col('media')}/create`,
      icon: ImageUp,
      allowed: Boolean(can.collections?.media?.create),
    },
    {
      label: 'Homepage',
      hint: 'Sections and featured posts',
      href: `${admin}/globals/homepage`,
      icon: LayoutTemplate,
      allowed: Boolean(can.globals?.homepage?.update),
    },
    {
      label: 'Header & menu',
      hint: 'Top navigation',
      href: `${admin}/globals/header`,
      icon: Menu,
      allowed: Boolean(can.globals?.header?.update),
    },
    {
      label: 'Footer',
      hint: 'Links and contact details',
      href: `${admin}/globals/footer`,
      icon: PanelBottom,
      allowed: Boolean(can.globals?.footer?.update),
    },
    {
      label: 'Site settings',
      hint: 'Name, social, SEO defaults',
      href: `${admin}/globals/site-settings`,
      icon: Settings,
      allowed: Boolean(can.globals?.['site-settings']?.update),
    },
  ]
  const allowedShortcuts = shortcuts.filter((s) => s.allowed)

  return (
    <div className="im-dash im-dash--view">
      <header className="im-dash__hero">
        <div>
          <p className="im-dash__eyebrow">
            {today} · {ROLE_LABEL[user.role ?? ''] ?? 'Staff'}
          </p>
          <h1 className="im-dash__title">
            {greeting(now)}, {name}
          </h1>
          <p className="im-dash__lead">Here is what is happening on Islam Malayalam.</p>
        </div>
        <div className="im-dash__hero-actions">
          <a href="/" target="_blank" rel="noopener noreferrer" className="im-dash__btn">
            <ExternalLink aria-hidden="true" />
            View site
          </a>
          {can.collections?.posts?.create ? (
            <Link href={`${posts}/create`} className="im-dash__btn im-dash__btn--primary">
              <Plus aria-hidden="true" />
              New post
            </Link>
          ) : null}
        </div>
      </header>

      <ul className="im-dash__stats" aria-label="Content totals">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <li key={label}>
            <Link href={href} className="im-dash__stat">
              <span className="im-dash__stat-icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="im-dash__stat-value">{value.toLocaleString('en-IN')}</span>
              <span className="im-dash__stat-label">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="im-dash__grid">
        <div className="im-dash__col">
          <Panel
            title={data.ownDraftsOnly ? 'Your recent drafts' : 'Recent drafts'}
            icon={FilePen}
            href={draftsHref}
          >
            <PostRows
              rows={data.drafts}
              admin={admin}
              empty="No drafts. Everything is published."
            />
          </Panel>
          <Panel title="Recently published" icon={Send} href={posts}>
            <PostRows rows={data.published} admin={admin} empty="Nothing published yet." />
          </Panel>
          {data.stats.needsReview > 0 ? (
            <Panel title="Needs review" icon={Flag} href={reviewHref}>
              <PostRows rows={data.review} admin={admin} empty="Nothing is waiting for review." />
            </Panel>
          ) : null}
        </div>

        <div className="im-dash__col">
          {allowedShortcuts.length ? (
            <Panel title="Quick actions" icon={FilePlus2}>
              <ul className="im-dash__shortcuts">
                {allowedShortcuts.map(({ label, hint, href, icon: Icon }) => (
                  <li key={href}>
                    <Link href={href} className="im-dash__shortcut">
                      <span className="im-dash__stat-icon">
                        <Icon aria-hidden="true" />
                      </span>
                      <span>
                        <span className="im-dash__shortcut-label">{label}</span>
                        <span className="im-dash__shortcut-hint">{hint}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
          {canRead('contact-messages') ? (
            <Panel title="Inbox" icon={Inbox} href={col('contact-messages')}>
              <MessageRows rows={data.messages} admin={admin} />
            </Panel>
          ) : null}
          {canRead('categories') ? (
            <Panel title="Published posts by category" icon={FolderTree} href={col('categories')}>
              <CategoryBars rows={data.categories} admin={admin} />
            </Panel>
          ) : null}
          {canRead('audit-logs') ? (
            <Panel title="Recent activity" icon={Activity} href={col('audit-logs')}>
              <ActivityRows rows={data.activity} admin={admin} />
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}
