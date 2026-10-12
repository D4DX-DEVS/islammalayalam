/**
 * Which admin buttons ask "Are you sure?" first. Payload already confirms Delete, Unpublish and
 * leaving with unsaved changes; these cover the actions that change the live site or an account
 * immediately. Pure so it can be unit-tested; AdminEnhancements applies it to real clicks.
 */
export interface ConfirmRule {
  heading: string
  body: string
  confirmLabel: string
}

/** Buttons the guard listens for (ids set by @payloadcms/ui). */
export const GUARDED_BUTTONS = 'button#action-save, button#force-unlock'

const ADMIN = '/admin'

const RULES = {
  publishPost: {
    heading: 'Publish this post?',
    body: 'It goes live on the website straight away and readers will see these changes.',
    confirmLabel: 'Publish',
  },
  savePage: {
    heading: 'Save and update the live page?',
    body: 'Pages have no drafts: saving changes the page on the website straight away.',
    confirmLabel: 'Save and update',
  },
  saveUser: {
    heading: 'Save changes to this account?',
    body: 'Role, email and password changes apply immediately and can lock someone out.',
    confirmLabel: 'Save account',
  },
  saveSettings: {
    heading: 'Update the whole website?',
    body: 'These settings are shared by every page; the change is visible to all visitors at once.',
    confirmLabel: 'Save settings',
  },
  forceUnlock: {
    heading: 'Unlock this account?',
    body: 'The account was locked after too many failed logins. Unlock it only if you know the owner made those attempts.',
    confirmLabel: 'Unlock account',
  },
} as const satisfies Record<string, ConfirmRule>

export function confirmRuleFor(
  buttonId: string,
  pathname: string,
  buttonLabel: string,
): ConfirmRule | null {
  if (buttonId === 'force-unlock') return RULES.forceUnlock
  if (buttonId !== 'action-save') return null

  const path = pathname.replace(/\/+$/, '')
  if (path === `${ADMIN}/account` || path.startsWith(`${ADMIN}/collections/users/`))
    return RULES.saveUser
  if (path.startsWith(`${ADMIN}/globals/`)) return RULES.saveSettings
  if (path.startsWith(`${ADMIN}/collections/pages/`)) return RULES.savePage
  // Posts have drafts: the main button is "Publish" / "Publish changes"; "Save draft" is separate.
  if (path.startsWith(`${ADMIN}/collections/posts/`) && /publish/i.test(buttonLabel))
    return RULES.publishPost
  return null
}
