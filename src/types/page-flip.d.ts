// page-flip 2.0.7 ships TypeScript sources but no declarations: the part of its API the e-book reader uses.
declare module 'page-flip/dist/js/page-flip.module.js' {
  export interface PageFlipSettings {
    width: number
    height: number
    size?: 'fixed' | 'stretch'
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    startPage?: number
    drawShadow?: boolean
    flippingTime?: number
    usePortrait?: boolean
    autoSize?: boolean
    maxShadowOpacity?: number
    showCover?: boolean
    mobileScrollSupport?: boolean
    showPageCorners?: boolean
    disableFlipByClick?: boolean
    swipeDistance?: number
  }
  export interface PageFlipEvent<T = unknown> {
    data: T
  }
  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings)
    loadFromHTML(items: HTMLElement[] | NodeListOf<HTMLElement>): void
    on(event: 'flip', cb: (e: PageFlipEvent<number>) => void): this
    on(event: 'changeOrientation', cb: (e: PageFlipEvent<'portrait' | 'landscape'>) => void): this
    on(event: 'init', cb: (e: PageFlipEvent<{ page: number; mode: string }>) => void): this
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    turnToPage(page: number): void
    getCurrentPageIndex(): number
    getPageCount(): number
    getOrientation(): 'portrait' | 'landscape'
    update(): void
    destroy(): void
  }
}
