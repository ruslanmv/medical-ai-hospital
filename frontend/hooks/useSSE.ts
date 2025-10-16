'use client';
import * as React from 'react';

export function useSSE(path: string, onLine: (line: string) => void) {
  React.useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_API_BASE || '';
    const url = origin + path;
    const es = new EventSource(url, { withCredentials: true });

    const handler = (e: MessageEvent) => {
      // The server will send raw lines when proxied; EventSource gives us `data:` already
      onLine(`data: ${e.data}`);
    };

    es.addEventListener('message', handler);
    es.onerror = () => { /* auto-reconnect by browser */ };

    return () => es.close();
  }, [path, onLine]);
}
