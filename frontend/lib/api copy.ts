// frontend/lib/api.ts — hardened fetch helper for Next.js
// - Centralizes base URL resolution & credentials
// - Adds default timeouts and better error messages
// - Returns parsed JSON (when possible) and throws on HTTP errors
// - Works in both server and client components

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Resolve base at import time to avoid `this` binding issues
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080').replace(/\/$/, '');

// Default timeout for network requests (ms)
const DEFAULT_TIMEOUT = 15000; // 15s

// Polyfill AbortController timeout for both server/client runtimes
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  if (timeoutMs <= 0) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  if (signal) {
    // If caller-provided signal aborts first, cancel our timer and abort too
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      ctrl.abort();
    });
  }
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) } as const;
}

async function doFetch<T = unknown>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  const { timeoutMs = DEFAULT_TIMEOUT, ...rest } = init;

  const timeout = withTimeout(rest.signal as AbortSignal | undefined, timeoutMs);

  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        ...(rest.method && rest.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
        ...(rest.headers || {}),
      },
      ...rest,
      // Ensure we pass the composed signal (for timeout)
      signal: timeout?.signal,
    });

    // HTTP error -> throw with payload body if JSON
    if (!res.ok) {
      let detail: unknown = undefined;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try { detail = await res.json(); } catch { /* noop */ }
      } else {
        try { detail = await res.text(); } catch { /* noop */ }
      }
      const message = typeof detail === 'string' ? detail : JSON.stringify(detail ?? {});
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${message}`);
    }

    // Parse JSON when possible; otherwise return as any
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return (await res.json()) as T;
    }
    // If the server returns empty or non-JSON, expose as text
    const text = await res.text();
    return text as unknown as T;
  } catch (err: any) {
    // Map AbortError to a clearer timeout message
    if (err?.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    // Surface network/CORS failures with helpful hint
    const hint = `Failed to reach API at ${API_BASE}. Is the gateway running and CORS configured?`;
    throw new Error(`${err?.message || err} | ${hint}`);
  } finally {
    // Clear timeout timer if still active
    try { timeout?.cancel(); } catch { /* noop */ }
  }
}

export const api = {
  base: API_BASE,

  get<T = unknown>(path: string, init?: RequestInit & { timeoutMs?: number }) {
    return doFetch<T>(path, { method: 'GET', ...(init || {}) });
  },

  post<T = unknown>(path: string, body?: any, init?: RequestInit & { timeoutMs?: number }) {
    return doFetch<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined, ...(init || {}) });
  },

  put<T = unknown>(path: string, body?: any, init?: RequestInit & { timeoutMs?: number }) {
    return doFetch<T>(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined, ...(init || {}) });
  },

  patch<T = unknown>(path: string, body?: any, init?: RequestInit & { timeoutMs?: number }) {
    return doFetch<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined, ...(init || {}) });
  },

  delete<T = unknown>(path: string, init?: RequestInit & { timeoutMs?: number }) {
    return doFetch<T>(path, { method: 'DELETE', ...(init || {}) });
  },
};
