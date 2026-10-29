import { adminManifest } from '@/lib/admin-app'

export const dynamic = 'force-static'

/** /admin.webmanifest */
export function GET(): Response {
  return Response.json(adminManifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
