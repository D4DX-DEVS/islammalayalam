'use client'

import { useId, useState } from 'react'
import type { DashboardRow } from '../dashboardData'
import { PostRows } from './parts'

/**
 * Recent posts with an All / Drafts / Published switch. The three lists are loaded on the server
 * (dashboardData.ts, as the signed-in user); switching only chooses which one to show.
 */
type Tab = 'all' | 'drafts' | 'published'

const TABS: Array<{ id: Tab; label: string; empty: string }> = [
  { id: 'all', label: 'All', empty: 'No posts yet.' },
  { id: 'drafts', label: 'Drafts', empty: 'No drafts. Everything is published.' },
  { id: 'published', label: 'Published', empty: 'Nothing published yet.' },
]

export function RecentPosts({
  admin,
  recent,
  drafts,
  published,
}: {
  admin: string
  recent: DashboardRow[]
  drafts: DashboardRow[]
  published: DashboardRow[]
}) {
  const [tab, setTab] = useState<Tab>('all')
  const uid = useId()
  const rows = tab === 'all' ? recent : tab === 'drafts' ? drafts : published
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]!
  return (
    <>
      <div className="im-seg im-seg--head" role="group" aria-label="Which posts to show">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="im-seg__btn"
            aria-pressed={tab === t.id}
            aria-controls={`${uid}-list`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${uid}-list`} aria-live="polite">
        <PostRows rows={rows} admin={admin} empty={active.empty} />
      </div>
    </>
  )
}
