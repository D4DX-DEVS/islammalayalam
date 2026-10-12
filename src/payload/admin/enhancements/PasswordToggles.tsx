'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Adds a show/hide (eye) button to every password input in the admin — login, change password,
 * reset password — without forking Payload's views. A small host <span> is placed right after
 * each input and the button is portalled into it, so React owns the button.
 */
type Slot = { input: HTMLInputElement; host: HTMLElement }

const hosts = new WeakMap<HTMLInputElement, HTMLElement>()

function collectSlots(): Slot[] {
  const slots: Slot[] = []
  document
    .querySelectorAll<HTMLInputElement>('input[type="password"], input[data-im-pwd]')
    .forEach((input) => {
      let host = hosts.get(input)
      if (!host || !host.isConnected) {
        host = document.createElement('span')
        host.className = 'im-pwd-toggle-host'
        input.insertAdjacentElement('afterend', host)
        input.parentElement?.classList.add('im-pwd-wrap')
        input.dataset.imPwd = '1'
        hosts.set(input, host)
      }
      slots.push({ input, host })
    })
  return slots
}

const sameSlots = (a: Slot[], b: Slot[]): boolean =>
  a.length === b.length && a.every((s, i) => s.input === b[i]?.input && s.host === b[i]?.host)

/** The input belongs to Payload's DOM, not to this component's props/state. */
function setRevealed(input: HTMLInputElement, revealed: boolean): void {
  input.setAttribute('type', revealed ? 'text' : 'password')
}

function Toggle({ input }: { input: HTMLInputElement }) {
  const [shown, setShown] = useState(input.type === 'text')
  const Icon = shown ? EyeOff : Eye
  return (
    <button
      type="button"
      className="im-pwd-toggle"
      aria-label={shown ? 'Hide password' : 'Show password'}
      aria-pressed={shown}
      // Keep focus (and the caret) in the input.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setRevealed(input, !shown)
        setShown(!shown)
      }}
    >
      <Icon aria-hidden="true" />
    </button>
  )
}

export function PasswordToggles() {
  const [slots, setSlots] = useState<Slot[]>([])

  useEffect(() => {
    const scan = () => {
      const next = collectSlots()
      setSlots((prev) => (sameSlots(prev, next) ? prev : next))
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {slots.map(({ input, host }, i) => createPortal(<Toggle input={input} />, host, `pwd-${i}`))}
    </>
  )
}
