/**
 * Which tab of a bottom bar (the site's MobileDock, the admin's AdminDock) is the current page.
 * Pure, so both bars share it and it is unit-tested without a browser.
 */
export interface DockTarget {
  /** Where the tab leads. Tabs without one (Menu, New) are never "current". */
  href?: string
  /** Current on this exact path only (home screens), else for the whole section below it. */
  exact?: boolean
  /** Other sections that also make this tab current. */
  also?: readonly string[]
}

const trim = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, '') : path)

function covers(pathname: string, href: string, exact: boolean): boolean {
  const page = trim(pathname)
  const base = trim(href)
  if (exact || base === '/') return page === base
  return page === base || page.startsWith(`${base}/`)
}

/** Index of the tab that owns `pathname` (the longest matching section wins), or -1. */
export function activeTab(pathname: string, tabs: readonly DockTarget[]): number {
  let best = -1
  let bestLength = -1
  tabs.forEach((tab, index) => {
    for (const href of [tab.href, ...(tab.also ?? [])]) {
      if (href && href.length > bestLength && covers(pathname, href, Boolean(tab.exact))) {
        best = index
        bestLength = href.length
      }
    }
  })
  return best
}
