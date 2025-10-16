'use client';
import ChatPanel from '@/components/ChatPanel';

export default function ChatPage() {
  return (
    <div className="container-narrow">
      <h1 className="text-2xl font-semibold mb-4">Assistant</h1>
      <ChatPanel />
    </div>
  );
}
