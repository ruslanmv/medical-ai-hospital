'use client';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="bg-white/80 backdrop-blur border-b">
      <nav className="container-wide py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">{process.env.NEXT_PUBLIC_APP_NAME || 'Medical AI Portal'}</Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/dashboard" className="text-sm">Dashboard</Link>
              <Link href="/profile" className="text-sm">Profile</Link>
              <Link href="/chat" className="text-sm">Chat</Link>
              <button onClick={logout} className="text-sm rounded px-3 py-1 bg-gray-900 text-white">Logout</button>
            </>
          ) : (
            <>
              <Link href="/(auth)/login" className="text-sm">Login</Link>
              <Link href="/(auth)/register" className="text-sm">Register</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
