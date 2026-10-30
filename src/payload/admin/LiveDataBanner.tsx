import { TriangleAlert } from 'lucide-react'
import { getEnv, isLiveData } from '@/lib/env'

/**
 * A red strip across the top of every admin screen while a DEVELOPMENT server works on the live
 * data (`npm run dev:live`), so nobody mistakes it for the local playground. Production shows
 * nothing: there the live data is the normal case. Registered in admin.components.header.
 */
export function LiveDataBanner() {
  const env = getEnv()
  if (env.NODE_ENV !== 'development' || !isLiveData(env)) return null
  return (
    <div className="im-live-banner" role="status">
      <TriangleAlert aria-hidden="true" />
      <strong>Live data.</strong> Every save, upload and delete here changes the real website.
      <span className="im-live-banner__hint">Local playground: stop this and run npm run dev.</span>
    </div>
  )
}
