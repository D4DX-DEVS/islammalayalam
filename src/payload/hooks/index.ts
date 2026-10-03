import type { CollectionConfig } from 'payload'
import { auditCollectionChange, auditCollectionDelete } from './auditLog'
import { guardCollectionContent } from './contentGuard'
import { revalidateCollection, revalidateCollectionDelete } from './revalidate'

type Hooks = NonNullable<CollectionConfig['hooks']>

/**
 * Standard hook chain for every editable, publicly rendered collection:
 * integrity guard first, then collection-specific hooks, then cache purge + audit trail last.
 */
export function contentHooks(extra: Hooks = {}): Hooks {
  return {
    ...extra,
    beforeValidate: [guardCollectionContent, ...(extra.beforeValidate ?? [])],
    afterChange: [...(extra.afterChange ?? []), revalidateCollection, auditCollectionChange],
    afterDelete: [...(extra.afterDelete ?? []), revalidateCollectionDelete, auditCollectionDelete],
  }
}
