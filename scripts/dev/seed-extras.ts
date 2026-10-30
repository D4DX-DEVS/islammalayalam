import type { CollectionSlug, Payload, Where } from 'payload'
import { GENDERS, ORG_ANSWERS } from '@/features/postal/constants'
import { lexical, paragraph } from './fixtures'

/**
 * The rest of a working newsroom for the LOCAL seed: an editor and an author account, a few more
 * bylines, unfinished drafts (one flagged for review), inbox items (messages, postal library
 * requests), insights and quick audio / video entries. Everything is labelled മാതൃക (sample) and
 * every link uses a reserved .invalid host or a public sample id. Idempotent, like seed.ts.
 */
type Ctx = {
  context: Record<string, unknown>
  categoryIds: Map<string, string>
  images: string[]
  /** The dev admin's password is reused for the editor and author accounts (local DB only). */
  password: string
}

export const EXTRA_USERS = [
  { email: 'editor@islammalayalam.test', name: 'ഫാത്തിമ (editor)', role: 'editor' },
  { email: 'author@islammalayalam.test', name: 'അബ്ദുല്ല (author)', role: 'author' },
] as const

export const EXTRA_AUTHORS = [
  { name: 'അബ്ദുസ്സലാം (മാതൃക)', slug: 'abdussalam-sample' },
  { name: 'ഷഹ്‌ല (മാതൃക)', slug: 'shahla-sample' },
  { name: 'ആരിഫ് (മാതൃക)', slug: 'arif-sample' },
] as const

async function ensure(
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
  data: Record<string, unknown>,
  context: Record<string, unknown>,
): Promise<string> {
  const found = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    draft: true,
    overrideAccess: true,
    pagination: false,
  })
  const existing = found.docs[0] as { id: string } | undefined
  if (existing) {
    await payload.update({
      collection,
      id: existing.id,
      data: data as never,
      overrideAccess: true,
      context,
    })
    return existing.id
  }
  const created = await payload.create({
    collection,
    data: data as never,
    overrideAccess: true,
    context,
  })
  return String(created.id)
}

export async function seedUsers(payload: Payload, ctx: Ctx): Promise<void> {
  for (const user of EXTRA_USERS)
    await ensure(
      payload,
      'users',
      { email: { equals: user.email } },
      { ...user, password: ctx.password },
      ctx.context,
    )
}

export async function seedAuthors(payload: Payload, ctx: Ctx): Promise<string[]> {
  const ids: string[] = []
  for (const author of EXTRA_AUTHORS) {
    ids.push(
      await ensure(
        payload,
        'authors',
        { slug: { equals: author.slug } },
        {
          ...author,
          bio: lexical([paragraph('മാതൃകാ എഴുത്തുകാരൻ. യഥാർത്ഥ വിവരണം പിന്നീട് ചേർക്കാം.')]),
        },
        ctx.context,
      ),
    )
  }
  return ids
}

/** Unfinished work: three drafts, one of them flagged for review with a note. */
export async function seedDrafts(payload: Payload, ctx: Ctx, authorIds: string[]): Promise<void> {
  const drafts = [
    { title: 'മാതൃകാ കരട്: സ്വഭാവശുദ്ധിയും ദൈനംദിന ജീവിതവും', review: false },
    { title: 'മാതൃകാ കരട്: ഖുർആൻ പാരായണത്തിന്റെ മര്യാദകൾ', review: true },
    { title: 'മാതൃകാ കരട്: പുതിയ തലമുറയും മതബോധവും', review: false },
  ]
  for (const [i, draft] of drafts.entries()) {
    await ensure(
      payload,
      'posts',
      { title: { equals: draft.title } },
      {
        title: draft.title,
        postNumber: 900101 + i,
        excerpt: 'എഴുതിക്കൊണ്ടിരിക്കുന്ന മാതൃകാ ലേഖനം.',
        content: lexical([paragraph('കരട് ഉള്ളടക്കം. ഇനിയും പൂർത്തിയാക്കണം.')]),
        featuredImage: ctx.images[(i + 3) % ctx.images.length] ?? null,
        format: 'standard',
        categories: [ctx.categoryIds.get('ലേഖനം')].filter(Boolean),
        author: authorIds[i % authorIds.length],
        flags: draft.review
          ? { needsReview: true, reviewNote: 'ഉദ്ധരണികൾ പരിശോധിക്കണം (മാതൃക).' }
          : { needsReview: false },
        _status: 'draft',
      },
      ctx.context,
    )
  }
}

export async function seedInbox(payload: Payload, ctx: Ctx): Promise<void> {
  const messages = [
    { name: 'റഹീം (മാതൃക)', subject: 'ഖുർആൻ ക്ലാസ്സിനെക്കുറിച്ച്', status: 'new' },
    { name: 'സുമയ്യ (മാതൃക)', subject: 'പുസ്തകം എങ്ങനെ വാങ്ങാം?', status: 'new' },
    { name: 'Joseph (sample)', subject: 'Question about Ramadan timings', status: 'read' },
    { name: 'അനസ് (മാതൃക)', subject: 'ലേഖനത്തിലെ തെറ്റ്', status: 'replied' },
    { name: 'spam bot', subject: 'Buy followers now', status: 'spam' },
  ]
  for (const [i, m] of messages.entries())
    await ensure(
      payload,
      'contact-messages',
      { subject: { equals: m.subject } },
      {
        ...m,
        email: `reader${i + 1}@example.invalid`,
        message: `മാതൃകാ സന്ദേശം ${i + 1}. ഇത് പ്രാദേശിക വികസന ഡാറ്റ മാത്രമാണ്.`,
      },
      ctx.context,
    )

  const requests = [
    { name: 'നൗഷാദ് (മാതൃക)', status: 'new' },
    { name: 'ലീന (മാതൃക)', status: 'new' },
    { name: 'Arun (sample)', status: 'in-progress' },
    { name: 'ഹസ്ന (മാതൃക)', status: 'member' },
  ]
  for (const [i, r] of requests.entries())
    await ensure(
      payload,
      'postal-requests',
      { name: { equals: r.name } },
      {
        ...r,
        age: 24 + i * 7,
        gender: GENDERS[i % 2],
        address: `മാതൃകാ വിലാസം ${i + 1}, കോഴിക്കോട്`,
        pincode: '673001',
        phone: `+91 90000 0000${i}`,
        email: `request${i + 1}@example.invalid`,
        education: 'Degree (sample)',
        religion: 'Sample',
        orgMember: ORG_ANSWERS[1],
        readBefore: 'മാതൃകാ ഉത്തരം: ചില ലേഖനങ്ങൾ വായിച്ചിട്ടുണ്ട്.',
        difficulties: 'മാതൃകാ ഉത്തരം.',
        favouriteAspect: 'മാതൃകാ ഉത്തരം: സാഹോദര്യം.',
        wantsToLearn: 'മാതൃകാ ഉത്തരം: ആരാധനകൾ.',
      },
      ctx.context,
    )
}

export async function seedLibrary(payload: Payload, ctx: Ctx): Promise<void> {
  const insights = [
    'അറിവ് തേടുന്നത് ഓരോ മുസ്‌ലിമിന്റെയും കടമയാണ്. (മാതൃക)',
    'ക്ഷമയോടെ നിൽക്കുന്നവർക്ക് ഒപ്പമാണ് അല്ലാഹു. (മാതൃക)',
    'നല്ല വാക്ക് ഒരു ദാനമാണ്. (മാതൃക)',
    'ഏറ്റവും ഉത്തമൻ ജനങ്ങൾക്ക് ഏറ്റവും ഉപകാരമുള്ളവനാണ്. (മാതൃക)',
    'കോപം വരുമ്പോൾ മൗനം പാലിക്കുക. (മാതൃക)',
    'സത്യം പറയുക, അത് കയ്പായാലും. (മാതൃക)',
  ]
  for (const [i, text] of insights.entries())
    await ensure(
      payload,
      'quotes',
      { text: { equals: text } },
      {
        text,
        source: i % 2 ? 'ഹദീസ് (മാതൃക)' : 'ഖുർആൻ (മാതൃക)',
        poster: i < 3 ? (ctx.images[(i + 6) % ctx.images.length] ?? null) : null,
        active: true,
      },
      ctx.context,
    )

  const videos = ['wB70YxLsM-o', 'LiiaID_Q5os', 'j4mVf_j6xF4']
  for (const [i, id] of videos.entries())
    await ensure(
      payload,
      'videos',
      { link: { equals: `https://www.youtube.com/watch?v=${id}` } },
      {
        link: `https://www.youtube.com/watch?v=${id}`,
        title: `മാതൃകാ വീഡിയോ ${i + 1}`,
        author: 'Islam Malayalam',
        active: true,
      },
      ctx.context,
    )
  const audios = ['4rOoJ6Egrf8K2IrywzLOMo', '5CfCWKI5pZ28U0uOzXkDHe']
  for (const [i, id] of audios.entries())
    await ensure(
      payload,
      'audios',
      { link: { equals: `https://open.spotify.com/episode/${id}` } },
      {
        link: `https://open.spotify.com/episode/${id}`,
        title: `മാതൃകാ ഓഡിയോ ${i + 1}`,
        author: 'Islam Malayalam',
        active: true,
      },
      ctx.context,
    )
}
