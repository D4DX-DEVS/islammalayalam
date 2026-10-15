import { SocialIcon } from '@/components/layout/SocialLinks'

/**
 * Floating "Ask a Question" chat widget, bottom right on every page: the WhatsApp mark and its label
 * are always visible (white on a deeper green than WhatsApp's own, for text contrast). A soft pulse
 * draws the eye. Opens WhatsApp in a new tab, with the greeting
 * editors set in Site settings pre-filled.
 */
export function WhatsAppButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ask a Question on WhatsApp"
      className="group fixed bottom-4 end-4 z-40 inline-flex h-14 items-center overflow-hidden rounded-full bg-[#0a8443] text-white shadow-[0_10px_28px_-8px_rgb(10_132_67/0.7)] ring-1 ring-black/5 transition duration-300 hover:-translate-y-0.5 hover:bg-[#096f39] hover:shadow-[0_14px_32px_-8px_rgb(10_132_67/0.85)] focus-visible:-translate-y-0.5 sm:bottom-5 sm:end-5"
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full bg-[#0a8443] motion-safe:animate-ping-soft"
        aria-hidden="true"
      />
      <span className="relative inline-flex size-14 shrink-0 items-center justify-center">
        <SocialIcon network="whatsapp" className="size-7" />
      </span>
      <span className="relative whitespace-nowrap pe-5 text-sm font-semibold sm:text-[0.95rem]">
        Ask a Question
      </span>
    </a>
  )
}
