/** Routing helpers shared by src/proxy.ts and tests. */
export const isAdminPath = (pathname: string): boolean =>
  pathname === '/admin' || pathname.startsWith('/admin/')

/** Public page paths get the WordPress-style trailing slash; API/admin/Next assets and files do not. */
export function needsTrailingSlash(pathname: string): boolean {
  if (pathname === '/' || pathname.endsWith('/')) return false
  if (
    isAdminPath(pathname) ||
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname.startsWith('/_next/')
  )
    return false
  const last = pathname.slice(pathname.lastIndexOf('/') + 1)
  return !last.includes('.')
}
