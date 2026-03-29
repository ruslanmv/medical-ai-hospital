"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function ChatPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  const send = async () => {
    const text = inputRef.current?.value?.trim();
    if (!text) return;
    const currentVal = inputRef.current!.value;
    inputRef.current!.value = "";
    setMessages((m) => [...m, { role: "user", content: currentVal }]);
    try {
      const resp: any = await api.post("/chat/send", { message: text });
      const display = resp?.message || JSON.stringify(resp?.result ?? resp, null, 2);
      setMessages((m) => [...m, { role: "assistant", content: display }]);
    } catch (e: any) {
      const msg = e?.message || "Something went wrong";
      if (msg.includes("401")) {
        router.replace("/login");
        return;
      }
      setMessages((m) => [...m, { role: "system", content: msg }]);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-slate-500">Loading...</p></div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="grid gap-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">AI Intake</h1>
      <Card>
        <CardContent className="p-4 min-h-[400px] flex flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-slate-500 h-full flex items-center justify-center">Start by asking a question about your symptoms or profile.</p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-lg px-4 py-2 text-sm max-w-xs md:max-w-md ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    <pre className="whitespace-pre-wrap break-words font-sans">{m.content}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Input ref={inputRef} placeholder="Type your message…" onKeyDown={(e) => e.key === 'Enter' && send()} />
        <Button onClick={send} className="bg-indigo-600 hover:bg-indigo-500">Send</Button>
      </div>
    </div>
  );
}
