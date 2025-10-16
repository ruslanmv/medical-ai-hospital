'use client';
import * as React from 'react';
import { api } from '@/lib/api';
import { useSSE } from '@/hooks/useSSE';

export default function ChatPanel() {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<string[]>([]);

  useSSE('/chat/events', (line) => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload) return;
    setMessages((m) => [...m, payload]);
  });

  const send = async () => {
    if (!input) return;
    await api.post('/chat/send', { message: input, args: {} });
    setInput('');
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <div className="h-80 overflow-auto border rounded p-3 mb-3 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className="mb-2 text-sm whitespace-pre-wrap">{m}</div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Type your message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send} className="rounded bg-gray-900 text-white px-4 py-2">Send</button>
      </div>
    </div>
  );
}
