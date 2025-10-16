// frontend/lib/api.ts — production-ready fetch helper for Next.js

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  status?: number;
  data?: unknown;
  url: string;
  constructor(message: string, opts: { status?: number; data?: unknown; url: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.data = opts.data;
    this.url = opts.url;
  }
}

// Resolve base at import time
const rawBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8080';
const API_BASE = rawBase.replace(/\/+$/, ''); // strip trailing slashes

// Build absolute URL ensuring exactly one slash between base and path
function buildUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

// Defaults
const DEFAULT_TIMEOUT = 15_000; // ms
const DEFAULT_RETRIES = 1; // retry network/Abort and some 5xx once
const RETRY_STATUSES = new Set([502, 503, 504]);

// AbortController helper with timeout
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number) {
  if (!timeoutMs || timeoutMs <= 0) return undefined;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      ctrl.abort();
    });
  }
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) } as const;
}

async function doFetch<T = unknown>(
  path: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<T> {
  const url = buildUrl(path);
  const { timeoutMs = DEFAULT_TIMEOUT, retries = DEFAULT_RETRIES, ...rest } = init;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    const timeout = withTimeout(rest.signal as AbortSignal | undefined, timeoutMs);
    try {
      const res = await fetch(url, {
        credentials: 'include',
        mode: 'cors',
        headers: {
          Accept: 'application/json',
          ...(rest.method && rest.method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
          ...(rest.headers || {}),
        },
        ...rest,
        signal: timeout?.signal,
      });

      if (!res.ok) {
        let detail: unknown = undefined;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          try { detail = await res.json(); } catch { /* ignore */ }
        } else {
          try { detail = await res.text(); } catch { /* ignore */ }
        }
        const httpError = new ApiError(`HTTP ${res.status} ${res.statusText}`, {
          status: res.status,
          data: detail,
          url,
        });
        if (RETRY_STATUSES.has(res.status) && attempt < retries) {
          attempt += 1;
          await new Promise((r) => setTimeout(r, 300 * attempt));
          continue;
        }
        throw httpError;
      }

      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return (await res.json()) as T;
      }
      return (await res.text()) as T;
    } catch (err: any) {
      lastErr = err;
      if (err?.name === 'AbortError') {
        lastErr = new ApiError(`Request to ${url} timed out after ${timeoutMs}ms`, { url });
      }
      const isApiError = lastErr instanceof ApiError;
      if ((!isApiError || (isApiError && !(lastErr as ApiError).status)) && attempt < retries) {
        attempt += 1;
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }

      const msg = (lastErr as Error)?.message || String(lastErr);
      const hint = `Failed to reach API at ${API_BASE}. Is the gateway running and CORS configured?`;
      throw lastErr instanceof ApiError
        ? new ApiError(`${msg} | ${hint}`, { status: lastErr.status, data: (lastErr as ApiError).data, url })
        : new ApiError(`${msg} | ${hint}`, { url });
    } finally {
      timeout?.cancel();
    }
  }

  // Should not be reachable
  throw new ApiError('Unknown fetch failure', { url });
}

export const api = {
  base: API_BASE,

  get<T = unknown>(path: string, init?: Omit<RequestInit, 'body' | 'method'> & { timeoutMs?: number; retries?: number }) {
    return doFetch<T>(path, { method: 'GET', ...init });
  },

  post<T = unknown>(path: string, body?: any, init?: Omit<RequestInit, 'body' | 'method'> & { timeoutMs?: number; retries?: number }) {
    return doFetch<T>(path, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : undefined,
      ...init,
    });
  },

  put<T = unknown>(path: string, body?: any, init?: Omit<RequestInit, 'body' | 'method'> & { timeoutMs?: number; retries?: number }) {
    return doFetch<T>(path, {
      method: 'PUT',
      body: body != null ? JSON.stringify(body) : undefined,
      ...init,
    });
  },

  patch<T = unknown>(path: string, body?: any, init?: Omit<RequestInit, 'body' | 'method'> & { timeoutMs?: number; retries?: number }) {
    return doFetch<T>(path, {
      method: 'PATCH',
      body: body != null ? JSON.stringify(body) : undefined,
      ...init,
    });
  },

  delete<T = unknown>(path: string, init?: Omit<RequestInit, 'body' | 'method'> & { timeoutMs?: number; retries?: number }) {
    return doFetch<T>(path, { method: 'DELETE', ...init });
  },
};