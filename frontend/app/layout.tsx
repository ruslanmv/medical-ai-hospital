"use client";
import "../styles/globals.css";
import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

export default function RootLayout({ children }: PropsWithChildren) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "Medical AI Portal";
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <QueryClientProvider client={queryClient}>
          <div className="relative min-h-screen flex flex-col">
            <Navbar appName={appName} />
            <main className="container mx-auto flex-1 w-full px-4 sm:px-6 lg:px-8 pb-16 pt-8">
              {children}
            </main>
            <footer className="border-t bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 text-sm text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p>© {new Date().getFullYear()} Hospital AI. All rights reserved.</p>
                <p className="inline-flex gap-3">
                  <span className="hover:text-slate-700 cursor-pointer">Privacy</span>
                  <span>•</span>
                  <span className="hover:text-slate-700 cursor-pointer">Terms</span>
                  <span>•</span>
                  <span className="hover:text-slate-700 cursor-pointer">Security</span>
                </p>
              </div>
            </footer>
          </div>
          <Toaster />
        </QueryClientProvider>
      </body>
    </html>
  );
}
