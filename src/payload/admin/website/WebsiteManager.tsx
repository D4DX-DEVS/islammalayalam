import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  BookOpen,
  Bot,
  Calendar,
  CircleHelp,
  CirclePlay,
  Clapperboard,
  Smartphone,
  ExternalLink,
  GalleryHorizontal,
  Globe,
  Grid2x2,
  Headphones,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  MessageCircle,
  List,
  Megaphone,
  Newspaper,
  PanelBottom,
  PanelTop,
  Pencil,
  Phone,
  Plus,
  Quote,
  Settings,
  Share2,
  Tags,
  Type,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import type { ContentCard, SectionIcon, SectionRow, WebsiteData } from '../websiteModel'
import { MoveSection } from './MoveSection'

/** The "Website manager" screen: presentation only (data: websiteData.ts, styles: admin-website.scss). */

const ICONS: Record<SectionIcon, LucideIcon> = {
  header: PanelTop,
  settings: Settings,
  footer: PanelBottom,
  hero: GalleryHorizontal,
  strip: LayoutGrid,
  lead: Newspaper,
  topics: Tags,
  grid: Grid2x2,
  list: List,
  video: CirclePlay,
  audio: Headphones,
  ebook: BookOpen,
  text: Type,
  banner: ImageIcon,
  promo: Megaphone,
  faq: CircleHelp,
  quote: Quote,
  reels: Clapperboard,
  shorts: Smartphone,
  links: Link2,
  contact: Phone,
  social: Share2,
  chat: MessageCircle,
  ai: Bot,
}

function Group({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string
  hint: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <section className="im-dash__panel im-site__group">
      <header className="im-dash__panel-head">
        <h2>
          <span className="im-dash__panel-icon">
            <Icon aria-hidden="true" />
          </span>
          {title}
        </h2>
      </header>
      <p className="im-site__hint">{hint}</p>
      {children}
    </section>
  )
}

function Row({ row, number }: { row: SectionRow; number?: number }) {
  const Icon = ICONS[row.icon]
  return (
    <li className={`im-site__row${row.hidden ? ' is-hidden' : ''}`}>
      {number ? (
        <span className="im-site__num" aria-hidden="true">
          {number}
        </span>
      ) : null}
      <span className="im-site__icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="im-site__main">
        <p className="im-site__title">
          <strong>{row.label}</strong>
          {row.auto ? <span className="im-site__badge">Automatic</span> : null}
          {row.hidden ? <span className="im-site__badge im-site__badge--off">Hidden</span> : null}
        </p>
        {row.detail ? <p className="im-site__detail">{row.detail}</p> : null}
        {row.note ? <p className="im-site__note">{row.note}</p> : null}
      </div>
      <div className="im-site__actions">
        {row.move ? <MoveSection {...row.move} label={row.label} /> : null}
        {row.editHref ? (
          <Link href={row.editHref} className="im-dash__btn im-dash__btn--primary im-site__btn">
            <Pencil aria-hidden="true" />
            {row.editLabel}
          </Link>
        ) : (
          <span className="im-site__locked">{row.readOnly ?? 'View only'}</span>
        )}
        {row.moreHref ? (
          <Link href={row.moreHref} className="im-dash__btn im-site__btn">
            <ImageIcon aria-hidden="true" />
            {row.moreLabel ?? 'Edit'}
          </Link>
        ) : null}
        <a
          href={row.viewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="im-site__view"
          aria-label={`${row.label} — open on the live site`}
        >
          View
          <ExternalLink aria-hidden="true" />
        </a>
      </div>
    </li>
  )
}

function ContentTile({ card }: { card: ContentCard }) {
  return (
    <li className="im-site__tile">
      <p className="im-site__tile-count">{card.count ?? '—'}</p>
      <p className="im-site__tile-label">{card.label}</p>
      <p className="im-site__tile-hint">{card.hint}</p>
      <div className="im-site__tile-actions">
        <Link href={card.listHref}>Open</Link>
        {card.createHref ? (
          <Link href={card.createHref} className="im-site__tile-new">
            <Plus aria-hidden="true" />
            New
          </Link>
        ) : null}
      </div>
    </li>
  )
}

const UPLOAD_GUIDE = [
  {
    kind: 'Images',
    how: 'JPG, PNG, GIF or WebP. Checked and re-encoded on upload. Add them in the Media library, then pick them in a post, category or the Homepage.',
  },
  {
    kind: 'PDF files',
    how: 'E-books and downloads. Upload in the Media library, then attach to an E-book post or an article.',
  },
  {
    kind: 'Video',
    how: 'Paste a YouTube link in a Video post (and, optionally, its length — shown as a badge). Videos are not stored on this site.',
  },
  {
    kind: 'Audio',
    how: 'Paste a Spotify link, or a link to an audio file hosted on the media CDN, in an Audio post. Audio files cannot be uploaded to the Media library.',
  },
] as const

export function WebsiteManager({
  data,
  mediaCreateHref,
  postCreateHref,
}: {
  data: WebsiteData
  mediaCreateHref: string | null
  postCreateHref: string | null
}) {
  return (
    <div className="im-dash im-dash--view im-site">
      <header className="im-dash__hero">
        <div>
          <p className="im-dash__eyebrow">Website manager</p>
          <h1 className="im-dash__title">Every page and section of the site</h1>
          <p className="im-dash__lead">
            Listed in the order visitors see them. <strong>Edit</strong> opens the screen that
            changes it; <strong>View</strong> shows it live. Every change is saved to the audit log.
          </p>
        </div>
        <div className="im-dash__hero-actions">
          <a href="/" target="_blank" rel="noopener noreferrer" className="im-dash__btn">
            <Globe aria-hidden="true" />
            Open the site
          </a>
          {postCreateHref ? (
            <Link href={postCreateHref} className="im-dash__btn">
              <Plus aria-hidden="true" />
              New post
            </Link>
          ) : null}
          {mediaCreateHref ? (
            <Link href={mediaCreateHref} className="im-dash__btn im-dash__btn--primary">
              <Upload aria-hidden="true" />
              Upload media
            </Link>
          ) : null}
        </div>
      </header>

      <Group
        icon={LayoutTemplate}
        title="Homepage"
        hint="Sections from top to bottom. Use the arrows to move a section up or down (the top ads banner too); add, retitle or hide sections in the Homepage editor — “Hide this section” keeps the settings but stops showing it."
      >
        {data.homepageEmpty ? (
          <p className="im-dash__empty">
            The homepage has no sections yet. Open the Homepage editor and add a Hero first.
          </p>
        ) : null}
        <ol className="im-site__flow">
          {data.homepage.map((row, i) => (
            <Row key={row.key} row={row} number={i + 1} />
          ))}
        </ol>
        {data.sidebar.length ? (
          <>
            <h3 className="im-site__subhead">Sidebar</h3>
            <ul className="im-site__flow">
              {data.sidebar.map((row) => (
                <Row key={row.key} row={row} />
              ))}
            </ul>
          </>
        ) : null}
      </Group>

      <Group
        icon={Globe}
        title="On every page"
        hint="Shown on the homepage, articles, categories and search."
      >
        <ul className="im-site__flow">
          {data.site.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </ul>
      </Group>

      <Group
        icon={Newspaper}
        title="Content"
        hint="Everything the sections above are filled from. Open a list to edit, or create something new."
      >
        <ul className="im-site__tiles">
          {data.content.map((card) => (
            <ContentTile key={card.key} card={card} />
          ))}
        </ul>
      </Group>

      <Group icon={Calendar} title="Uploading" hint="What can be added, and where.">
        <dl className="im-site__guide">
          {UPLOAD_GUIDE.map((g) => (
            <div key={g.kind}>
              <dt>{g.kind}</dt>
              <dd>{g.how}</dd>
            </div>
          ))}
        </dl>
      </Group>
    </div>
  )
}
