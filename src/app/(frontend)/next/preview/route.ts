import { draftMode } from 'next/headers'
import type { NextRequest } from 'next/server'
import { authenticatePreview, previewPathOf } from '@/features/preview/session'
import { isCrossSite } from '@/lib/fetch-site'
import { getPayloadClient } from '@/lib/payload'
import { parsePreviewTarget } from '@/lib/preview'

/**
 * Live preview entry (the admin's preview iframe / "Preview" button). Turns on Next draft mode for a
 * verified staff session, then redirects to the document's own public path. The redirect target is
 * looked up from the document, never taken from the query string (no open redirect).
 */
const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
const deny = (status: number, message: string) =>
  new Response(message, { status, headers: { ...NO_STORE, 'Content-Type': 'text/plain' } })

export async function GET(request: NextRequest): Promise<Response> {
  if (isCrossSite(request.headers)) return deny(403, 'Open the preview from the admin.')
  const target = parsePreviewTarget(request.nextUrl.searchParams)
  if (!target) return deny(400, 'Invalid preview link.')

  const payload = await getPayloadClient()
  const user = await authenticatePreview(payload, request.headers)
  const draft = await draftMode()
  if (!user) {
    draft.disable()
    return deny(403, 'Sign in to the admin (including the 2-step code) to preview.')
  }
  const path = await previewPathOf(payload, user, target)
  if (!path) return deny(404, 'Nothing to preview yet: save the document first.')

  draft.enable()
  return new Response(null, { status: 307, headers: { ...NO_STORE, Location: path } })
}
