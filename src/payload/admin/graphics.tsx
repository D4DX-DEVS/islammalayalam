/* eslint-disable @next/next/no-img-element -- admin graphics are server-rendered static files */

/**
 * Admin branding (config: admin.components.graphics) — the site's own logo from public/brand.
 * Styles (incl. the dark-theme swap) live in app/(payload)/custom.scss.
 */

/** Login / TOTP screens. */
export function AdminLogo() {
  return (
    <span className="im-logo">
      <img
        className="im-logo__img im-logo__img--light"
        src="/brand/logo.png"
        width={544}
        height={180}
        alt="Islam Malayalam — ഇസ്‌ലാം മലയാളം"
      />
      <img
        className="im-logo__img im-logo__img--dark"
        src="/brand/logo-mobile.png"
        width={280}
        height={93}
        alt="Islam Malayalam — ഇസ്‌ലാം മലയാളം"
      />
      <span className="im-logo__sub">Content admin</span>
    </span>
  )
}

/** Top-left of the navigation. */
export function AdminIcon() {
  return (
    <img
      className="im-icon"
      src="/brand/icon-192.png"
      width={192}
      height={192}
      alt="Islam Malayalam"
    />
  )
}
