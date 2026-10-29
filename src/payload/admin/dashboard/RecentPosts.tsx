'use client'

import { useId, useState } from 'react'
import type { DashboardRow } from '../dashboardData'
import { PostRows } from './parts'

/**
 * Recent posts with All / Published / Drafts / Needs review tabs, each with its total. The lists
 * are loaded on the server (dashboardData.ts, as the signed-in user); a tab only chooses which one
 * to show, and "View all posts" opens the full list.
 */
type Tab = 'all' | 'published' | 'drafts' | 'review'

const TABS: Array<{ id: Tab; label: string; empty: string }> = [
  { id: 'all', label: 'All', empty: 'No posts yet.' },
  { id: 'published', label: 'Published', empty: 'Nothing published yet.' },
  { id: 'drafts', label: 'Drafts', empty: 'No drafts. Everything is published.' },
  { id: 'review', label: 'Needs review', empty: 'Nothing is waiting for review.' },
]

export function RecentPosts({
  admin,
  lists,
  counts,
}: {
  admin: string
  lists: Record<Tab, DashboardRow[]>
  counts: Record<Tab, number>
}) {
  const [tab, setTab] = useState<Tab>('all')
  const uid = useId()
  const active = TABS.find((t) => t.id === tab) ?? TABS[0]!
  return (
    <>
      <div className="im-ptabs" role="group" aria-label="Which posts to show">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="im-ptabs__btn"
            aria-pressed={tab === t.id}
            aria-controls={`${uid}-list`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="im-ptabs__count">{counts[t.id].toLocaleString('en-IN')}</span>
          </button>
        ))}
      </div>
      <div id={`${uid}-list`} className="im-ptable__fill" aria-live="polite">
        <PostRows rows={lists[tab]} admin={admin} empty={active.empty} />
      </div>
    </>
  )
}
