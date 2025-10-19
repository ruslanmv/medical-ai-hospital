'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * Page component: returns a Suspense boundary wrapping the client form.
 * This satisfies Next.js requirement for useSearchParams().
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-10">
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-48 rounded bg-gray-200" />
            <div className="h-10 w-full rounded bg-gray-200" />
            <div className="h-10 w-full rounded bg-gray-200" />
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

/**
 * Child component that actually uses useSearchParams().
 * Rendering is wrapped by Suspense in the page above.
 */
function ResetPasswordForm() {
  const search = useSearchParams();
  const token = useMemo(() => search.get('token') || '', [search]);

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tokenMissing = !token;

  useEffect(() => {
    if (tokenMissing) {
      setError('The reset link is missing a token. Please use the link from your email.');
    }
  }, [tokenMissing]);

  const canSubmit =
    !submitting && !!newPassword && !!confirm && newPassword === confirm && !tokenMissing;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await api('/auth/reset-password', { token, new_password: newPassword });
      setSuccess('Your password has been reset. You can now log in.');
    } catch (e: any) {
      setError(e?.message || 'Failed to reset password. The link may be invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {success} <Link className="underline" href="/login">Go to login</Link>
          </div>
        )}

        <Field
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter a strong password"
          autoComplete="new-password"
          required
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter the new password"
          autoComplete="new-password"
          required
        />
        {newPassword && confirm && newPassword !== confirm && (
          <p className="text-sm text-red-600">Passwords do not match.</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className={`rounded-lg px-4 py-2 text-white ${
              !canSubmit ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            } transition`}
          >
            {submitting ? 'Resetting…' : 'Reset Password'}
          </button>
          <Link className="text-sm text-gray-600 underline" href="/login">
            Back to login
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const { label, value, onChange, type = 'text', placeholder, autoComplete, required } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        type={type}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
      />
    </label>
  );
}
