/**
 * Fetch Metadata guard for state-changing GET routes (preview on/off): a link or embed on another
 * site must not toggle a signed-in staff member's preview. Browsers that send no header are allowed.
 */
export const isCrossSite = (headers: Headers): boolean =>
  headers.get('sec-fetch-site') === 'cross-site'
