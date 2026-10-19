'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Spotify's own player, driven from our page through Spotify's iFrame API
 * (open.spotify.com/embed/iframe-api/v1): pressing Play on an episode loads it into the player at
 * the top of the card and starts it, instead of asking the visitor to press play a second time
 * inside the embed. The embed stays visible (Spotify's terms), and if its script cannot load the
 * card falls back to a plain embedded player.
 */
interface PlaybackState {
  isPaused: boolean
  isBuffering: boolean
  /** Milliseconds. */
  duration: number
  position: number
}
interface Controller {
  loadUri(uri: string): void
  play(): void
  pause(): void
  togglePlay(): void
  destroy(): void
  addListener(
    event: 'ready' | 'playback_started' | 'playback_update',
    callback: (e: { data: PlaybackState }) => void,
  ): void
}
interface Api {
  createController(
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: Controller) => void,
  ): void
}
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: Api) => void
    __spotifyIframeApi?: Api
  }
}

const EMBED =
  /^https:\/\/open\.spotify\.com\/embed\/(episode|track|show|playlist|album|artist)\/([A-Za-z0-9]{22})$/

/** `https://open.spotify.com/embed/episode/<id>` → `spotify:episode:<id>`; null for anything else. */
export function embedUri(src: string | null | undefined): string | null {
  const m = EMBED.exec(src ?? '')
  return m ? `spotify:${m[1]}:${m[2]}` : null
}

const COMPACT = 152
const TALL = 352
/** How long to wait for playback to begin before showing "press play in the player". */
const BLOCKED_AFTER_MS = 6000

let loading: Promise<Api> | null = null
function loadApi(): Promise<Api> {
  loading ??= new Promise<Api>((resolve, reject) => {
    if (window.__spotifyIframeApi) return resolve(window.__spotifyIframeApi)
    const timer = window.setTimeout(() => reject(new Error('Spotify did not answer')), 10_000)
    window.onSpotifyIframeApiReady = (api) => {
      window.clearTimeout(timer)
      window.__spotifyIframeApi = api
      resolve(api)
    }
    const script = document.createElement('script')
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('Spotify blocked'))
    }
    document.head.append(script)
  }).catch((err: Error) => {
    loading = null
    throw err
  })
  return loading
}

export type SpotifyState = { playing: boolean; position: number; duration: number }

/**
 * Keeps one Spotify player in `host` showing `uri` (null = the episode in the card is not a Spotify
 * one, so it is paused). `wantPlay` is true when the visitor asked for playback (a Play press), as
 * opposed to just stepping past an episode.
 */
export function useSpotifyEmbed({
  host,
  uri,
  tall,
  wantPlay,
  onState,
  onEnd,
}: {
  host: RefObject<HTMLDivElement | null>
  uri: string | null
  tall: boolean
  wantPlay: RefObject<boolean>
  onState: (state: SpotifyState) => void
  onEnd: () => void
}) {
  const control = useRef<Controller | null>(null)
  const shown = useRef<string | null>(null)
  const started = useRef(false)
  const ended = useRef(false)
  /** Play was asked for and has not begun yet: it is asked again once the embed says it is ready. */
  const pending = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const [unavailable, setUnavailable] = useState(false)
  // The address that playback was asked for and did not begin on (so a new episode starts clean).
  const [blockedFor, setBlockedFor] = useState<string | null>(null)
  const handlers = useRef({ onState, onEnd })
  useEffect(() => {
    handlers.current = { onState, onEnd }
  })

  const height = tall ? TALL : COMPACT

  /** Ask for playback, and say so if nothing starts (the browser refused it). */
  const start = useCallback(() => {
    started.current = false
    ended.current = false
    pending.current = true
    control.current?.play()
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (!started.current) setBlockedFor(shown.current)
    }, BLOCKED_AFTER_MS)
  }, [])

  useEffect(() => {
    if (!uri) {
      control.current?.pause()
      return
    }
    let cancelled = false
    const resize = () => {
      const frame = host.current?.querySelector('iframe')
      if (frame) frame.style.height = `${height}px`
    }
    const current = control.current
    if (current) {
      if (shown.current !== uri) {
        current.loadUri(uri)
        shown.current = uri
        resize()
      }
      if (wantPlay.current) start()
      return
    }
    loadApi()
      .then((api) => {
        const container = host.current
        if (cancelled || !container || control.current) return
        const slot = document.createElement('div')
        container.replaceChildren(slot)
        api.createController(slot, { uri, width: '100%', height }, (controller) => {
          control.current = controller
          shown.current = uri
          // Spotify makes its iframe lazy: one that is off screen (the card's top, on a phone) would
          // never load, so Play could not start it.
          container.querySelector('iframe')?.setAttribute('loading', 'eager')
          resize()
          // A command sent before the embed has loaded is lost: ask again when it is ready.
          controller.addListener('ready', () => {
            if (pending.current && !started.current) controller.play()
          })
          controller.addListener('playback_started', () => {
            started.current = true
            pending.current = false
            ended.current = false
            setBlockedFor(null)
          })
          controller.addListener('playback_update', ({ data }) => {
            handlers.current.onState({
              playing: !data.isPaused,
              position: data.position / 1000,
              duration: data.duration / 1000,
            })
            // Finished: paused at the very end (once, however many updates say so).
            if (
              data.isPaused &&
              data.duration > 0 &&
              data.position >= data.duration - 300 &&
              !ended.current
            ) {
              ended.current = true
              handlers.current.onEnd()
            }
          })
          if (wantPlay.current) start()
        })
      })
      .catch(() => setUnavailable(true))
    return () => {
      cancelled = true
    }
  }, [uri, host, height, start, wantPlay])

  const toggle = useCallback(() => control.current?.togglePlay(), [])
  const pause = useCallback(() => control.current?.pause(), [])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      control.current?.destroy()
      control.current = null
      shown.current = null
    },
    [],
  )

  return {
    /** Spotify's script could not be loaded: show a plain embed instead. */
    unavailable,
    /** Playback was asked for but has not begun: the visitor must press play in the embed. */
    blocked: blockedFor !== null && blockedFor === uri,
    toggle,
    pause,
  }
}
