'use client';

import { useEffect, useRef, useState } from 'react';
import { apiCall } from '@/lib/client';
import type { ResponsesInfo } from '@/lib/data';
import { AlertIcon, CheckCircleIcon, FileIcon, UploadIcon } from './icons';

const SOURCE_LABEL = { local: 'Laptop file', blob: 'Vercel Blob' } as const;

function when(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Admin: where the form responses are read from, and uploading a new CSV
 * (saved to the laptop's data folder, or to Vercel Blob on Vercel).
 */
export function ResponsesCard({ onUploaded }: { onUploaded: () => void }) {
  const [info, setInfo] = useState<ResponsesInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiCall<ResponsesInfo>('/api/admin/responses').then(({ ok, data }) => ok && setInfo(data as ResponsesInfo));
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    const { ok, data } = await apiCall<ResponsesInfo>('/api/admin/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: await file.text(),
    });
    setBusy(false);
    if (input.current) input.current.value = '';
    if (!ok) {
      setMessage({ kind: 'error', text: data.error ?? 'Upload failed. Try again.' });
      return;
    }
    setInfo(data as ResponsesInfo);
    setMessage({ kind: 'ok', text: `Loaded ${data.families} families from ${file.name}.` });
    onUploaded();
  }

  const target = info?.uploadTo === 'blob' ? 'privately in Vercel Blob' : 'to data/responses.csv on this laptop';

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileIcon className="h-4 w-4 text-muted" /> Responses
        </h2>
        {info?.source ? (
          <span className="pill bg-success-soft text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> {SOURCE_LABEL[info.source]}
          </span>
        ) : (
          info && <span className="pill bg-warning-soft text-warning">Not loaded</span>
        )}
      </div>
      <div className="space-y-4 p-5">
        {info?.source ? (
          <p className="text-sm text-muted">
            <b className="text-ink tabular-nums">{info.families}</b> families
            {info.updatedAt && <> · updated {when(info.updatedAt)}</>}
          </p>
        ) : (
          info && <p className="text-sm text-muted">No responses loaded yet.</p>
        )}

        {info?.uploadBlocked ? (
          <p className="flex gap-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> {info.uploadBlocked}
          </p>
        ) : (
          <>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button onClick={() => input.current?.click()} disabled={!info || busy} className="btn btn-secondary w-full">
              <UploadIcon className="h-4 w-4" />
              {busy ? 'Checking and uploading…' : 'Upload responses CSV'}
            </button>
            {info && (
              <p className="text-xs leading-relaxed text-muted">
                Export the Google Form responses as CSV. The file is checked first, then saved {target}. Check-ins are kept.
              </p>
            )}
          </>
        )}

        {message && (
          <p
            className={`flex gap-2 rounded-xl p-3 text-sm ${message.kind === 'ok' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}
            role="status"
          >
            {message.kind === 'ok' ? <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />}
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
