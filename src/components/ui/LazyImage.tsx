'use client'

import { useEffect, useRef, useState } from 'react'
import Image, { type ImageProps } from 'next/image'

/**
 * next/image plus a lazy-load effect: an image that is still loading when the page hydrates shows a
 * shimmer and fades (and un-blurs) in when it arrives. Images already painted by the server HTML,
 * priority images and blur-placeholder images are left alone, so nothing flickers and LCP is
 * untouched. Without JavaScript the image is simply visible.
 */
export function LazyImage({ className = '', alt, onLoad, onError, ...props }: ImageProps) {
  const ref = useRef<HTMLImageElement>(null)
  const [pending, setPending] = useState(false)
  const skip =
    props.loading === 'eager' ||
    props.fetchPriority === 'high' ||
    props.preload === true ||
    props.placeholder === 'blur'

  useEffect(() => {
    const img = ref.current
    if (img && !skip && !img.complete) setPending(true)
  }, [skip])

  return (
    <>
      {pending ? (
        <span
          className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,var(--color-surface)_25%,var(--color-line)_50%,var(--color-surface)_75%)] bg-[length:200%_100%]"
          aria-hidden="true"
        />
      ) : null}
      <Image
        ref={ref}
        alt={alt}
        {...props}
        onLoad={(e) => {
          setPending(false)
          onLoad?.(e)
        }}
        onError={(e) => {
          setPending(false)
          onError?.(e)
        }}
        className={`${className} transition-[transform,opacity,filter] duration-700 ease-out ${pending ? 'opacity-0 blur-md' : 'opacity-100 blur-0'}`}
      />
    </>
  )
}
