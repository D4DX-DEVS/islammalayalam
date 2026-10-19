import type { MfaStep } from '@/lib/mfa-policy'

/**
 * Plain-language copy for the two-step verification switch (Settings → Security). Written for
 * a site admin who is not a developer: no "MFA", "TOTP" or "2FA" anywhere.
 */
export type TwoStepConfirm = { heading: string; body: string; confirmLabel: string }

/** One line under the switch describing what sign-in looks like right now. */
export const twoStepStatus = (on: boolean): string =>
  on
    ? 'After the password, every staff member also enters the 6-digit code from the authenticator app on their phone.'
    : 'The password alone signs staff in.'

const ME: Record<MfaStep, string> = {
  setup: ' You have not set it up yet, so you will be asked to scan a QR code right after this.',
  verify: ' You will be asked for your code right after this.',
}

/**
 * The confirmation shown before the switch is flipped. `myStep` is what the admin flipping it
 * would still owe once the step is required (src/lib/mfa-policy.ts mfaStepOwed): their own
 * session is sent to that screen straight after turning it on, so the dialog says so.
 */
export function twoStepConfirm(next: boolean, myStep: MfaStep | null): TwoStepConfirm {
  if (next) {
    const everyone =
      'From their next sign-in, every staff member must enter the 6-digit code from the authenticator app on their phone after their password. Anyone who has not set up the app yet is shown a QR code to scan the first time.'
    return {
      heading: 'Turn on two-step verification?',
      body: everyone + (myStep ? ME[myStep] : ''),
      confirmLabel: 'Turn on',
    }
  }
  return {
    heading: 'Turn off two-step verification?',
    body: 'The password alone will sign staff in. Anyone who learns a staff password can then get into the admin. Authenticator apps that are already set up are kept, so turning this back on later needs no new QR scan.',
    confirmLabel: 'Turn off',
  }
}

export const twoStepToast = (on: boolean): string =>
  on ? 'Two-step verification is on.' : 'Two-step verification is off.'
