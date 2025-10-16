"use client";
import Link from "next/link";
import { Hospital, LogIn, UserPlus, MessageSquare, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function Navbar({ appName }: { appName: string }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-white/75 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Hospital className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">{appName}</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" asChild>
                <Link href="/dashboard"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/profile"><UserPlus className="h-4 w-4 mr-2" />Profile</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/chat"><MessageSquare className="h-4 w-4 mr-2" />Chat</Link>
              </Button>
              <Button variant="outline" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild>
                <Link href="/login"><LogIn className="h-4 w-4 mr-2" />Sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/register"><UserPlus className="h-4 w-4 mr-2" />Register</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
