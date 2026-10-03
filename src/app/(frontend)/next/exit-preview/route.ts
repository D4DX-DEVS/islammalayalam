import { draftMode } from 'next/headers'
import type { NextRequest } from 'next/server'
import { isCrossSite } from '@/lib/fetch-site'
import { safeLocalPath } from '@/lib/preview'

/** Leave preview: drop the draft-mode cookie and return to the (published) page. Harmless if forged. */
export async function GET(request: NextRequest): Promise<Response> {
  if (!isCrossSite(request.headers)) (await draftMode()).disable()
  const to = safeLocalPath(request.nextUrl.searchParams.get('path'))
  return new Response(null, {
    status: 307,
    headers: { 'Cache-Control': 'no-store', Location: to },
  })
}
