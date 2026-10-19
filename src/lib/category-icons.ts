import {
  BookOpen,
  CirclePlay,
  Compass,
  Eye,
  FileText,
  Gift,
  Headphones,
  Heart,
  Landmark,
  Library,
  Lightbulb,
  MessagesSquare,
  Newspaper,
  Scale,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryIconName } from '@/lib/category-icon-names'

/**
 * Icon for a category tile. Matches on the slug or name (Malayalam and English spellings), in order;
 * anything unknown gets a stable fallback so a new category still has an icon without a code change.
 */
const MATCHERS: Array<[RegExp, LucideIcon]> = [
  [/news|സമകാലിക/i, Newspaper],
  [/ചോദ്യോത്തര|question|faq/i, MessagesSquare],
  [/video|വീഡിയോ|വിഡിയോ/i, CirclePlay],
  [/audio|ഓഡിയോ/i, Headphones],
  [/e-?books?|ഇ-?ബുക്/i, BookOpen],
  [/ഖുർ|ഖുര്‍|quran|qur'an/i, BookOpen],
  [/പുസ്തക|book|library/i, Library],
  [/ലേഖന|article/i, FileText],
  [/കാഴ്ചപ്പാട്|view|opinion/i, Eye],
  [/പ്രവാചക|നബി|prophet/i, Landmark],
  [/കുടുംബ|family/i, Users],
  [/സമൂഹ|social/i, Users],
  [/ചരിത്ര|histor/i, Landmark],
  [/ആദർശ|ആദര്‍ശ|belief|aqeedah/i, Sparkles],
]
/** The editor-picked icons (Categories → Icon), by the values in category-icon-names.ts. */
const BY_NAME: Record<CategoryIconName, LucideIcon> = {
  newspaper: Newspaper,
  messages: MessagesSquare,
  'file-text': FileText,
  eye: Eye,
  video: CirclePlay,
  headphones: Headphones,
  'book-open': BookOpen,
  library: Library,
  landmark: Landmark,
  users: Users,
  heart: Heart,
  lightbulb: Lightbulb,
  scale: Scale,
  star: Star,
  gift: Gift,
  sparkles: Sparkles,
  compass: Compass,
}
const FALLBACK: LucideIcon[] = [Compass, Lightbulb, Heart, Scale, Star, Gift, Sparkles]

function hash(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return h
}

export function categoryIcon(category: {
  slug?: string | null
  name: string
  icon?: CategoryIconName | null
}): LucideIcon {
  if (category.icon && BY_NAME[category.icon]) return BY_NAME[category.icon]
  const key = `${category.slug ?? ''} ${category.name}`
  for (const [pattern, icon] of MATCHERS) if (pattern.test(key)) return icon
  return FALLBACK[hash(key) % FALLBACK.length]!
}
