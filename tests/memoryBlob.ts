import { BlobConflict, type BlobClient, type BlobFile } from '@/lib/blob';

/**
 * An in-memory stand-in for Vercel Blob with the same write rules: create-only
 * writes fail if the file exists, ETag writes fail if it changed since it was
 * read. Like the real store, a plain read (a download) returns a weak ETag
 * that a conditional write won't accept; only a `forUpdate` read returns the
 * real one. Every call yields to the event loop, so concurrent callers
 * interleave the way separate serverless requests do.
 */
export function memoryBlob(): BlobClient & { files: Map<string, BlobFile> } {
  const files = new Map<string, BlobFile>();
  let version = 0;
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    files,
    configured: () => true,
    async read(pathname, { forUpdate = false } = {}) {
      await tick();
      const file = files.get(pathname);
      if (!file) return null;
      return forUpdate ? { ...file } : { ...file, etag: `W/${file.etag}` };
    },
    async write(pathname, body, { etag }) {
      await tick();
      const current = files.get(pathname);
      if (etag === null && current) throw new BlobConflict(pathname);
      if (etag && etag !== '*' && current?.etag !== etag) throw new BlobConflict(pathname);
      const file = { text: body, etag: `"v${++version}"`, uploadedAt: new Date() };
      files.set(pathname, file);
      return { etag: file.etag };
    },
  };
}
