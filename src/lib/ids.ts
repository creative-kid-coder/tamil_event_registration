// Crockford base32: no I, L, O, U, so codes are easy to read aloud and type.
export const TICKET_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Normalises user/scanner input ("k7q2m9xd", "K7Q2 M9XD") to "K7Q2-M9XD". */
export function normalizeTicketId(input: string): string {
  const compact = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

/** Pulls the ticket id out of a scanned QR (a /t/<id> URL, or a bare id). */
export function ticketIdFromScan(text: string): string {
  const match = text.match(/\/t\/([A-Za-z0-9-]+)/);
  return normalizeTicketId(match ? match[1] : text.trim());
}
