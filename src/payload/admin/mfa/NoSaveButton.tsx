'use client'

/**
 * Settings → Security has one switch that saves itself (TwoStepSwitch), so the global's Save
 * button, and with it Payload's Ctrl/Cmd+S hotkey, is removed.
 */
export function NoSaveButton() {
  return null
}
