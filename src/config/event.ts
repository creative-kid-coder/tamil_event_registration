export const EVENT = {
  name: process.env.EVENT_NAME || 'Our Event',
  date: process.env.EVENT_DATE || '',
  venue: process.env.EVENT_VENUE || '',
};

/**
 * Link to the guest's ticket page, or null when PUBLIC_BASE_URL isn't set
 * (e.g. a laptop behind a quick tunnel whose address changes every run).
 */
export function ticketUrl(ticketId: string): string | null {
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  return base ? `${base}/t/${encodeURIComponent(ticketId)}` : null;
}
