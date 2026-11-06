/**
 * Vercel Blob storage, for when the app runs on Vercel (no persistent disk).
 * The responses CSV, check-ins and programme statuses are kept there as
 * private files (no public URLs: they hold names, mobiles and emails).
 *
 * Reads skip the CDN cache so every desk sees the latest data. Writes are
 * conditional (ETag), so two desks saving at the same moment can't overwrite
 * each other: the second one re-reads and tries again.
 */
import { BlobPreconditionFailedError, get, put } from '@vercel/blob';

/** The connected store's env var prefix, e.g. TAMIL_EVENT → TAMIL_EVENT_READ_WRITE_TOKEN. */
const ENV_PREFIX = process.env.BLOB_ENV_PREFIX || 'TAMIL_EVENT';
/** Folder inside the store, so the app's files don't mix with anything else there. */
const PATH_PREFIX = process.env.BLOB_PATH_PREFIX ?? 'checkin-app/';

export const blobPath = (name: string) => `${PATH_PREFIX}${name}`;

type BlobAuth = { token: string } | { storeId: string };

function blobAuth(): BlobAuth | null {
  const token = process.env[`${ENV_PREFIX}_READ_WRITE_TOKEN`] || process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return { token };
  // Newer Vercel projects can authenticate with OIDC instead of a token.
  const storeId = process.env[`${ENV_PREFIX}_STORE_ID`] || process.env.BLOB_STORE_ID;
  if (storeId && process.env.VERCEL_OIDC_TOKEN) return { storeId };
  return null;
}

function requireAuth(): BlobAuth {
  const auth = blobAuth();
  if (!auth) {
    throw new Error(`Vercel Blob is not connected: set ${ENV_PREFIX}_READ_WRITE_TOKEN (connect the Blob store to the project in Vercel)`);
  }
  return auth;
}

/** Someone else wrote the file between our read and our write (or created it first). */
export class BlobConflict extends Error {}

export interface BlobFile {
  text: string;
  etag: string;
  uploadedAt: Date;
}

export interface BlobClient {
  configured(): boolean;
  read(pathname: string): Promise<BlobFile | null>;
  /**
   * `etag`: overwrite only if unchanged since that read; `null`: create only
   * (fails if it exists); `'*'`: overwrite whatever is there.
   */
  write(pathname: string, body: string, options: { etag: string | null; contentType: string }): Promise<{ etag: string }>;
}

const vercelBlob: BlobClient = {
  configured: () => blobAuth() !== null,

  async read(pathname) {
    const result = await get(pathname, { access: 'private', useCache: false, ...requireAuth() });
    if (!result || result.statusCode !== 200) return null;
    return { text: await new Response(result.stream).text(), etag: result.blob.etag, uploadedAt: result.blob.uploadedAt };
  },

  async write(pathname, body, { etag, contentType }) {
    const condition = etag === '*' ? { allowOverwrite: true } : etag ? { ifMatch: etag } : { allowOverwrite: false };
    try {
      const result = await put(pathname, body, { access: 'private', addRandomSuffix: false, contentType, ...condition, ...requireAuth() });
      return { etag: result.etag };
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || /already exists/i.test(String((error as Error)?.message))) {
        throw new BlobConflict(pathname);
      }
      throw error;
    }
  },
};

let client: BlobClient = vercelBlob;

export const blob = () => client;

/** For tests: an in-memory store instead of Vercel Blob. */
export function setBlobClient(replacement: BlobClient | null) {
  client = replacement ?? vercelBlob;
  recent.clear();
}

/**
 * Where check-ins and programme statuses live: the SQLite file on the laptop,
 * or Vercel Blob on Vercel (which has no persistent disk).
 */
export const storageMode = (): 'disk' | 'blob' => (process.env.VERCEL || process.env.STORAGE === 'blob' ? 'blob' : 'disk');

/** Recent reads, per server instance: desks and guest phones refresh every few seconds. */
const recent = new Map<string, { doc: unknown; at: number }>();

/**
 * Reads a JSON file, reusing a copy read in the last `maxAgeMs` (so many phones
 * refreshing don't each cost a Blob read). Saves always read fresh.
 */
export async function readJson<T>(pathname: string, empty: () => T, maxAgeMs = 0): Promise<T> {
  const hit = recent.get(pathname);
  if (hit && Date.now() - hit.at < maxAgeMs) return structuredClone(hit.doc) as T;
  const file = await client.read(pathname);
  const doc = file ? (JSON.parse(file.text) as T) : empty();
  recent.set(pathname, { doc, at: Date.now() });
  return structuredClone(doc);
}

/** Several desks saving in the same instant each get a turn; this is the most turns one save waits. */
const MAX_ATTEMPTS = 15;

/**
 * Read–change–save a JSON file without losing anyone else's change. `change`
 * edits the document in place and says whether it needs saving; if another
 * write got in first, it runs again on the fresh copy.
 */
export async function updateJson<T, R>(pathname: string, empty: () => T, change: (doc: T) => { value: R; save: boolean }): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    const file = await client.read(pathname);
    const doc = file ? (JSON.parse(file.text) as T) : empty();
    const { value, save } = change(doc);
    if (!save) return value;
    try {
      await client.write(pathname, JSON.stringify(doc), { etag: file?.etag ?? null, contentType: 'application/json' });
      recent.set(pathname, { doc: structuredClone(doc), at: Date.now() });
      return value;
    } catch (error) {
      if (!(error instanceof BlobConflict) || attempt >= MAX_ATTEMPTS) {
        throw error instanceof BlobConflict ? new Error('Too many people saving at once. Please try again.') : error;
      }
      await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 100 * attempt));
    }
  }
}
