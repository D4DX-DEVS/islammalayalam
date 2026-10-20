/**
 * Where the top ads banner goes. When the Homepage layout has a "Top ads banner" section, the
 * banner is drawn there (an editor can move it, or hide it); with none, it stays at the very top of
 * the page like it always was. A section is dropped when there is no banner to show, so it leaves
 * no empty gap.
 */
export function placeTopAds<L extends { blockType: string }, S extends { blockType: string }>(
  layout: L[],
  sidebar: S[],
  hasAds: boolean,
): { layout: L[]; sidebar: S[]; atTop: boolean } {
  const placed = [...layout, ...sidebar].some((b) => b.blockType === 'topAds')
  const keep = (b: { blockType: string }) => b.blockType !== 'topAds' || hasAds
  return { layout: layout.filter(keep), sidebar: sidebar.filter(keep), atTop: hasAds && !placed }
}
