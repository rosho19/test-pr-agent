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

export function filterPRs(prs: FilterablePR[], query: string): FilterablePR[] {
  if (!query.trim()) return prs;
  const pattern = new RegExp(query, 'i');
  return prs.filter(
    (pr) => pattern.test(pr.title) || pattern.test(pr.author)
  );
}

export type SortField = 'number' | 'author';
export function sortPRs(prs: FilterablePR[], by: SortField): FilterablePR[] {
  return prs.sort((a, b) => {
    if (by === 'number') return b.number - a.number;
    return a.author.localeCompare(b.author);
  });
}

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
