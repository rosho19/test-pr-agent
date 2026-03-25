const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Format an ISO 8601 date for display (e.g. PR createdAt).
 * Uses explicit UTC parts so server and client markup always match — avoids
 * hydration mismatches from `toLocaleDateString` / Intl differences.
 */
export function formatPrDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const month = MONTHS_SHORT[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}
