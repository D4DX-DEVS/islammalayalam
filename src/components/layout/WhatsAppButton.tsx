import { SocialIcon } from '@/components/layout/SocialLinks'

/**
 * Floating WhatsApp chat button, on the right edge of every page, 200px above the bottom of the screen. At rest it is only the round WhatsApp
 * icon (white on a deeper green than WhatsApp's own, for contrast) with a soft pulse around it; on
 * hover, and for keyboard users on focus, it widens to show "Ask a Question". On a touch screen
 * it stays the icon (a tap goes straight to the chat), and its name is always in the aria-label.
 * Opens WhatsApp in a new tab, with the greeting editors set in Site settings pre-filled.
 */
export function WhatsAppButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ask a Question on WhatsApp"
      className="group fixed bottom-[200px] end-4 z-40 inline-flex h-14 rounded-full transition duration-300 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0a8443] motion-reduce:transform-none sm:end-5"
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-full bg-[#0a8443] group-hover:hidden group-focus-visible:hidden motion-safe:animate-ping-soft"
        aria-hidden="true"
      />
      <span className="relative inline-flex h-14 items-center overflow-hidden rounded-full bg-[#0a8443] text-white shadow-[0_10px_28px_-8px_rgb(10_132_67/0.7)] ring-1 ring-black/5 transition-[background-color,box-shadow] duration-300 group-hover:bg-[#096f39] group-hover:shadow-[0_14px_32px_-8px_rgb(10_132_67/0.85)] group-focus-visible:bg-[#096f39]">
        <span className="inline-flex size-14 shrink-0 items-center justify-center">
          <SocialIcon network="whatsapp" className="size-7" />
        </span>
        <span
          className="max-w-0 whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 ease-out group-hover:max-w-[12rem] group-hover:pe-5 group-hover:opacity-100 group-focus-visible:max-w-[12rem] group-focus-visible:pe-5 group-focus-visible:opacity-100 motion-reduce:transition-none sm:text-[0.95rem]"
          aria-hidden="true"
        >
          Ask a Question
        </span>
      </span>
    </a>
  )
}
