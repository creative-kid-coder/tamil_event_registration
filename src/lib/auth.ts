/** Edge-safe (used by middleware): no Node-only imports here. */
import { jwtVerify, SignJWT } from 'jose';

export type Role = 'desk' | 'admin';
export interface Session {
  /** Who signed in, as they typed it (e.g. "Desk 1 – Priya"). */
  name: string;
  role: Role;
}

export const SESSION_COOKIE = 'checkin_session';
export const SESSION_HOURS = 18;
const MIN_PIN_LENGTH = 6;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return value;
}

const signingKey = () => new TextEncoder().encode(secret());

function pinFor(role: Role): string {
  const name = role === 'admin' ? 'ADMIN_PIN' : 'DESK_PIN';
  const pin = process.env[name];
  if (!pin || pin.length < MIN_PIN_LENGTH) throw new Error(`${name} must be set to at least ${MIN_PIN_LENGTH} characters`);
  return pin;
}

/**
 * Short fingerprint of the role's current PIN, stored in the session. Changing
 * a PIN therefore signs out everyone who signed in with the old one.
 */
async function pinFingerprint(role: Role): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${role}:${pinFor(role)}:${secret()}`));
  return Array.from(new Uint8Array(digest).subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** The admin PIN opens the admin page and the desk; the desk PIN opens the desk only. */
export function roleForPin(pin: string): Role | null {
  const adminPin = pinFor('admin');
  const deskPin = pinFor('desk');
  if (constantTimeEqual(pin, adminPin)) return 'admin';
  if (constantTimeEqual(pin, deskPin)) return 'desk';
  return null;
}

export async function createSession(session: Session): Promise<string> {
  return new SignJWT({ name: session.name, role: session.role, pin: await pinFingerprint(session.role) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(signingKey());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, signingKey());
    const role = payload.role === 'admin' || payload.role === 'desk' ? payload.role : null;
    if (!role || typeof payload.name !== 'string') return null;
    if (payload.pin !== (await pinFingerprint(role))) return null;
    return { name: payload.name, role };
  } catch {
    return null;
  }
}

type CookieReader = { cookies: { get(name: string): { value: string } | undefined } };

/** Reads the session from any request that carries cookies (route handlers and middleware). */
export async function sessionFrom(req: CookieReader) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}
