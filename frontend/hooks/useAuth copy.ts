'use client';
import * as React from 'react';
import { api } from '@/lib/api';

export function useAuth() {
  const [user, setUser] = React.useState<{ id: string; email: string } | null>(null);

  React.useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await api.get('/auth/me');
      if (!res.ok) return;
      const data = await res.json();
      if (!ignore) setUser({ id: data.id, email: data.email });
    })();
    return () => { ignore = true; };
  }, []);

  const logout = async () => {
    await api.post('/auth/logout', {});
    location.href = '/(auth)/login';
  };

  return { user, logout };
}
