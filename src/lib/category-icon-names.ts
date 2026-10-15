/**
 * The icons an editor can pick for a category tile (Categories → Icon). Plain data, no React, so the
 * admin config and the site share one list; src/lib/category-icons.ts maps each value to its drawing.
 */
export const CATEGORY_ICON_OPTIONS = [
  { value: 'newspaper', label: 'Newspaper (news)' },
  { value: 'messages', label: 'Chat bubbles (questions)' },
  { value: 'file-text', label: 'Document (articles)' },
  { value: 'eye', label: 'Eye (views)' },
  { value: 'video', label: 'Play circle (videos)' },
  { value: 'headphones', label: 'Headphones (audio)' },
  { value: 'book-open', label: 'Open book (Qur’an, e-books)' },
  { value: 'library', label: 'Bookshelf (books)' },
  { value: 'landmark', label: 'Landmark (history, prophets)' },
  { value: 'users', label: 'People (society, family)' },
  { value: 'heart', label: 'Heart' },
  { value: 'lightbulb', label: 'Light bulb (ideas)' },
  { value: 'scale', label: 'Scales (justice)' },
  { value: 'star', label: 'Star' },
  { value: 'gift', label: 'Gift (free resources)' },
  { value: 'sparkles', label: 'Sparkles (belief)' },
  { value: 'compass', label: 'Compass (guidance)' },
] as const

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number]['value']
