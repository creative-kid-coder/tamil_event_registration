'use client';

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: Partial<T> & { error?: string };
}

/** fetch + JSON for the browser. Sends the user to /login when the session has expired. */
export async function apiCall<T>(
  url: string,
  init: RequestInit & { redirectOn401?: boolean } = {},
): Promise<ApiResult<T>> {
  const { redirectOn401 = true, ...rest } = init;
  try {
    const res = await fetch(url, {
      ...rest,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...rest.headers },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && redirectOn401) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    const data = { error: 'No connection — check Wi-Fi / mobile data and try again' } as ApiResult<T>['data'];
    return { ok: false, status: 0, data };
  }
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}
