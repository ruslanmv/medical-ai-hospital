export function createSSE(path: string): EventSource {
  const origin = process.env.NEXT_PUBLIC_API_BASE || '';
  const url = origin + path;
  return new EventSource(url, { withCredentials: true });
}
