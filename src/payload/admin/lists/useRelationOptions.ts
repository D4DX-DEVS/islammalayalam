'use client'

import { useCallback, useEffect, useState } from 'react'
import { useConfig } from '@payloadcms/ui'
import { whereParams } from './listQuery'

/**
 * Items of another collection for relationship filters (Categories, Author…), read from Payload's
 * REST API as the signed-in user, so access control applies. Titles are cached for the session:
 * chips name the picked items without asking again.
 */
export type RelationItem = { id: string; title: string }
type Status = 'loading' | 'ready' | 'error'

const titles = new Map<string, string>()
const key = (relationTo: string, id: string) => `${relationTo}:${id}`

function useRelationApi(relationTo: string | undefined) {
  const { config, getEntityConfig } = useConfig()
  const target = relationTo ? getEntityConfig({ collectionSlug: relationTo }) : undefined
  const titleField = target?.admin?.useAsTitle || 'id'
  return { base: `${config.routes.api}/${relationTo}`, titleField }
}

async function fetchItems(url: string, titleField: string, relationTo: string, signal: AbortSignal) {
  const res = await fetch(url, { credentials: 'include', signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { docs?: Array<Record<string, unknown>> }
  return (body.docs ?? []).map((doc) => {
    const id = String(doc.id)
    const raw = doc[titleField]
    const title = typeof raw === 'string' && raw.trim() ? raw : id
    titles.set(key(relationTo, id), title)
    return { id, title }
  })
}

/** Most titles looked up at once; a chip only names two, the panel lists the rest as they load. */
const TITLE_BATCH = 50
const SEARCH_LIMIT = 40

/** Titles for picked ids, fetched once per id. */
export function useRelationTitles(relationTo: string | undefined, ids: string[]): Record<string, string> {
  const { base, titleField } = useRelationApi(relationTo)
  const [, setVersion] = useState(0)
  const missing = relationTo
    ? ids.filter((id) => !titles.has(key(relationTo, id))).slice(0, TITLE_BATCH)
    : []
  const missingKey = JSON.stringify(missing)

  useEffect(() => {
    const wanted = JSON.parse(missingKey) as string[]
    if (!relationTo || wanted.length === 0) return
    const controller = new AbortController()
    const params = whereParams({ id: { in: wanted } })
    params.set('depth', '0')
    params.set('limit', String(wanted.length))
    if (titleField !== 'id') params.set(`select[${titleField}]`, 'true')
    fetchItems(`${base}?${params}`, titleField, relationTo, controller.signal)
      .then(() => setVersion((v) => v + 1))
      .catch(() => {
        // The chip keeps saying "1 selected" — still correct, just less specific.
      })
    return () => controller.abort()
  }, [base, missingKey, relationTo, titleField])

  const out: Record<string, string> = {}
  if (relationTo)
    for (const id of ids) {
      const title = titles.get(key(relationTo, id))
      if (title) out[id] = title
    }
  return out
}

/** Up to 40 items matching `query` by title, sorted by title; `more` when there are others. */
export function useRelationSearch(relationTo: string | undefined, query: string) {
  const { base, titleField } = useRelationApi(relationTo)
  const [items, setItems] = useState<RelationItem[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!relationTo) return
    const controller = new AbortController()
    const timer = setTimeout(
      () => {
        const q = query.trim()
        const params = q && titleField !== 'id' ? whereParams({ [titleField]: { like: q } }) : new URLSearchParams()
        params.set('depth', '0')
        params.set('limit', String(SEARCH_LIMIT))
        if (titleField !== 'id') {
          params.set('sort', titleField)
          params.set(`select[${titleField}]`, 'true')
        }
        setStatus('loading')
        fetchItems(`${base}?${params}`, titleField, relationTo, controller.signal)
          .then((list) => {
            setItems(list)
            setStatus('ready')
          })
          .catch(() => {
            if (!controller.signal.aborted) setStatus('error')
          })
      },
      query ? 250 : 0,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [attempt, base, query, relationTo, titleField])

  return { items, status, retry, more: items.length >= SEARCH_LIMIT }
}
