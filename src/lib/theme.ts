/**
 * Light/dark theme. Visitors who never chose follow their OS setting through CSS alone
 * (`prefers-color-scheme`). An explicit choice is stored in a small non-sensitive cookie that the
 * server reads, so the first paint is already correct — no inline script, no flash.
 */
export const THEME_COOKIE = 'im-theme'
export type Theme = 'light' | 'dark'

export const parseTheme = (value: string | undefined): Theme | undefined =>
  value === 'dark' || value === 'light' ? value : undefined
