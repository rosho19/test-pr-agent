/**
 * PR search and filter utilities.
 * Used by the dashboard sidebar to filter the live PR list.
 */

export interface FilterablePR {
  number: number;
  title: string;
  author: string;
  draft: boolean;
}

/**
 * Filter PRs by a free-text query.
 * Matches against title and author fields.
 *
 * BUG (high): builds a RegExp directly from user input with no escaping.
 * A query like `(((((` or `a++++b` will throw a SyntaxError and crash
 * the sidebar. An adversarial input like `(.*)*` causes catastrophic
 * backtracking (ReDoS) that blocks the main thread.
 * Fix: escape the string first — new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
 */
export function filterPRs(prs: FilterablePR[], query: string): FilterablePR[] {
  if (!query.trim()) return prs;
  const pattern = new RegExp(query, 'i');
  return prs.filter(
    (pr) => pattern.test(pr.title) || pattern.test(pr.author)
  );
}

/**
 * Sort PRs by a given field.
 *
 * BUG (medium): mutates the original array in place via .sort().
 * Callers that pass the same state array will see unexpected re-renders
 * because React uses reference equality for state comparisons.
 * Fix: return [...prs].sort(...) to sort a copy.
 */
export type SortField = 'number' | 'author';
export function sortPRs(prs: FilterablePR[], by: SortField): FilterablePR[] {
  return prs.sort((a, b) => {
    if (by === 'number') return b.number - a.number;
    return a.author.localeCompare(b.author);
  });
}

/**
 * Debounce a callback for search input.
 *
 * BUG (low): the returned function leaks the timer ID — if the component
 * that created the debounced function unmounts, the pending timer still
 * fires and calls the original callback on stale state.
 * Fix: expose a cancel() method or return a cleanup function for useEffect.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
