import { PostCard } from '@/components/cards/PostCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Pagination } from '@/components/ui/Pagination'
import type { PostList } from '@/features/posts/queries'

interface PostListingProps {
  list: PostList
  basePath: string
  emptyTitle: string
  emptyDescription?: string
  /** Extra query parameters carried by the pagination links (e.g. the search term). */
  query?: Record<string, string>
  hideCategory?: boolean
}

/**
 * Archive grid with SSR pagination (?page=N). Public archives keep a fixed page size (12) so every
 * page URL is stable and crawlable; there is deliberately no rows-per-page control here.
 */
export function PostListing({
  list,
  basePath,
  emptyTitle,
  emptyDescription,
  query,
  hideCategory,
}: PostListingProps) {
  if (!list.docs.length)
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={{ href: '/', label: 'ഹോം പേജിലേക്ക്' }}
      />
    )
  return (
    <>
      {list.totalPages > 1 ? (
        <p className="mb-6 text-sm font-medium text-muted">
          പേജ് {list.page} / {list.totalPages}
        </p>
      ) : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {list.docs.map((post, i) => (
          <li key={post.id}>
            <PostCard
              post={post}
              variant="grid"
              priority={i < 3}
              headingLevel="h2"
              hideCategory={hideCategory}
              compactOnMobile={i > 0}
            />
          </li>
        ))}
      </ul>
      <Pagination basePath={basePath} page={list.page} totalPages={list.totalPages} query={query} />
    </>
  )
}
