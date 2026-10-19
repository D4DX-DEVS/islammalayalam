'use client'

import { useEffect } from 'react'

const SELECTOR = '[data-reveal]:not([data-revealed], [data-reveal-done])'
const STEP_MS = 80
const MAX_STEPS = 6
/** A little longer than the 650ms CSS transition. */
const SETTLE_MS = 800

/**
 * Lazy-load entrance animation for everything marked `data-reveal="up|fade|zoom|left|right"`.
 * It only ever ADDS attributes (`data-revealed`, `data-reveal-done`) to the elements it animates.
 * Sections stream in and hydrate at their own pace, so one can hydrate after this has already
 * touched its elements; every element that carries `data-reveal` therefore also carries
 * `suppressHydrationWarning` (React then ignores attribute differences on that element). A unit
 * test (tests/unit/reveal-hydration.test.ts) fails if one is missing.
 * Mounted once in the layout. It never hides anything until the page has hydrated (see the
 * `.reveal-ready` rules in globals.css), so server HTML, no-JS visitors and crawlers always get the
 * content. Elements already on screen when this mounts stay put; the rest ease in as they near the
 * viewport, and elements that arrive together stagger left-to-right, top-to-bottom. Content that
 * streams in later or comes with a client navigation is picked up by the MutationObserver.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Arm only once the page has loaded and gone idle: by then React has hydrated the server HTML,
    // so changing attributes on it cannot cause (or be reported as) a hydration mismatch.
    let stop = () => {}
    let cancelled = false
    const arm = () => {
      if (!cancelled) stop = start()
    }
    const afterLoad = () => {
      // Safari has no requestIdleCallback.
      const idle = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
        .requestIdleCallback
      if (idle) idle(arm, { timeout: 2500 })
      else window.setTimeout(arm, 600)
    }
    if (document.readyState === 'complete') afterLoad()
    else window.addEventListener('load', afterLoad, { once: true })

    return () => {
      cancelled = true
      window.removeEventListener('load', afterLoad)
      stop()
    }
  }, [])

  return null
}

/** Starts watching; returns the function that stops it. */
function start(): () => void {
  {
    const root = document.documentElement
    const watched = new WeakSet<Element>()

    const reveal = (el: Element, step: number, animated = true) => {
      if (!animated) {
        // Already on screen when the page loaded: leave it exactly as it is (never hidden, never animated).
        el.setAttribute('data-reveal-done', '')
        return
      }
      const delay = Math.min(step, MAX_STEPS) * STEP_MS
      ;(el as HTMLElement).style.setProperty('--reveal-delay', `${delay}ms`)
      el.setAttribute('data-revealed', '')
      // Once it has played, hand the element's own transitions back (card hover lift etc.).
      window.setTimeout(() => el.setAttribute('data-reveal-done', ''), delay + SETTLE_MS)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              Math.round(a.boundingClientRect.top / 24) -
                Math.round(b.boundingClientRect.top / 24) ||
              a.boundingClientRect.left - b.boundingClientRect.left,
          )
          .forEach((entry, i) => {
            reveal(entry.target, i)
            observer.unobserve(entry.target)
          })
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    )

    const collect = (scope: Element | Document): Element[] => {
      const found = [...scope.querySelectorAll(SELECTOR)]
      if (scope instanceof Element && scope.matches(SELECTOR)) found.unshift(scope)
      return found
    }
    const watch = (els: Element[]) => {
      for (const el of els) {
        if (watched.has(el)) continue
        watched.add(el)
        observer.observe(el)
      }
    }

    // Already on screen: mark as shown before the hidden state is armed, so nothing flashes.
    for (const el of collect(document)) {
      // Lazy sections are below the fold by definition; measuring them would force them to render.
      if (el.closest('.lazy-section')) continue
      if (el.getBoundingClientRect().top < window.innerHeight) reveal(el, 0, false)
    }
    root.classList.add('reveal-ready')
    watch(collect(document))

    const mutations = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) if (node instanceof Element) watch(collect(node))
    })
    mutations.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mutations.disconnect()
      root.classList.remove('reveal-ready')
    }
  }
}
