export const EVENT = {
  name: process.env.EVENT_NAME || 'Our Event',
  date: process.env.EVENT_DATE || '',
  venue: process.env.EVENT_VENUE || '',
};

/**
 * The app's public address, used for the links in QR emails: PUBLIC_BASE_URL,
 * or on Vercel the project's production domain (which Vercel provides). Null
 * on a laptop behind a quick tunnel (its address changes every run), so QR
 * codes then hold just the ticket ID.
 */
export function publicBaseUrl(): string | null {
  const configured = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : null;
}

/** Link to the guest's ticket page, or null when there's no public address. */
export function ticketUrl(ticketId: string): string | null {
  const base = publicBaseUrl();
  return base ? `${base}/t/${encodeURIComponent(ticketId)}` : null;
}
