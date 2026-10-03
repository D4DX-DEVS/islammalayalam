import Link from 'next/link'
import type { ReactNode } from 'react'

interface SmartLinkProps {
  href: string | null
  external?: boolean
  newTab?: boolean
  className?: string
  children: ReactNode
  'aria-current'?: 'page' | 'true' | undefined
}

/** Internal → next/link, external → hardened <a>, no href → plain text (menu group labels). */
export function SmartLink({
  href,
  external,
  newTab,
  className,
  children,
  ...rest
}: SmartLinkProps) {
  if (!href) return <span className={className}>{children}</span>
  if (external || newTab) {
    return (
      <a
        href={href}
        className={className}
        target={newTab ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : newTab ? 'noopener' : undefined}
        {...rest}
      >
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  )
}
