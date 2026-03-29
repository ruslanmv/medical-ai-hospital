'use client';

import { useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

async function api<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordsMatch = pw && confirm && pw === confirm;
  const canSubmit = !submitting && !!email && !!pw && !!confirm && passwordsMatch;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await api('/auth/register', { email, password: pw });
      setSuccess('Account created successfully. You can now log in.');
      setEmail('');
      setPw('');
      setConfirm('');
    } catch (e: any) {
      setError(e?.message || 'Failed to register.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Create an Account</h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success} <Link className="underline" href="/login">Go to login</Link>
          </div>
        )}

        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Enter a strong password"
          autoComplete="new-password"
          required
        />
        <Field
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
          required
        />
        {pw && confirm && !passwordsMatch && (
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
            {submitting ? 'Creating…' : 'Create Account'}
          </button>
          <Link className="text-sm text-gray-600 underline" href="/login">
            Already have an account? Log in
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
