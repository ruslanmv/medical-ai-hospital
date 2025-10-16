'use client';
import * as React from 'react';
import { api, ApiError } from '@/lib/api';

// Define a type for the user object for better code clarity and safety
type User = { id: string; email: string };

export function useAuth() {
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    let ignore = false;

    const fetchUser = async () => {
      try {
        // The new `api.get` directly returns the JSON data or throws an error.
        // We specify the expected return type with `api.get<User>`.
        const data = await api.get<User>('/auth/me');
        if (!ignore) {
          setUser(data);
        }
      } catch (error) {
        // If the error is an ApiError (e.g., 401 Unauthorized) or a network error,
        // it means the user is not logged in. We can safely ignore it, and
        // the `user` state will correctly remain `null`.
        if (error instanceof ApiError) {
          console.log('User not authenticated:', error.message); // Optional: for debugging
        } else {
          console.error('An unexpected error occurred during auth check:', error);
        }
      }
    };

    fetchUser();

    // Cleanup function to prevent state updates on unmounted components
    return () => {
      ignore = true;
    };
  }, []);

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      // Even if the logout API call fails (e.g., server is down),
      // we should still proceed with redirecting the user.
      console.error("Logout API call failed, but redirecting anyway:", error);
    }
    // Use `window.location.href` for a full page navigation to clear state.
    window.location.href = '/(auth)/login';
  };

  return { user, logout };
}