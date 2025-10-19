'use client';

import { useEffect, useMemo, useState } from 'react';
import CountrySelect from '@/components/CountrySelect';

type PatientProfile = {
  patient_id: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null; // YYYY-MM-DD
  sex?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country_code?: string | null; // ISO-3166-1 alpha-2
};

type PatientUpdateIn = Partial<Omit<PatientProfile, 'patient_id'>>;

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null);
  const [initial, setInitial] = useState<PatientProfile | null>(null);

  // Form state; default country to US for new users
  const [form, setForm] = useState<PatientUpdateIn>({
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    email: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country_code: 'US',
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      setSuccess(null);
      setRefreshInfo(null);
      setLoading(true);
      try {
        const profile = await api<PatientProfile | null>('/me/patient');
        if (!mounted) return;

        setInitial(profile);

        setForm({
          first_name: profile?.first_name ?? '',
          middle_name: profile?.middle_name ?? '',
          last_name: profile?.last_name ?? '',
          date_of_birth: profile?.date_of_birth ?? '',
          sex: profile?.sex ?? '',
          email: profile?.email ?? '',
          phone: profile?.phone ?? '',
          address_line1: profile?.address_line1 ?? '',
          address_line2: profile?.address_line2 ?? '',
          city: profile?.city ?? '',
          state: profile?.state ?? '',
          postal_code: profile?.postal_code ?? '',
          country_code: profile?.country_code ?? 'US',
        });
      } catch (e: any) {
        setError(e?.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onChange =
    (name: keyof PatientUpdateIn) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [name]: e.target.value }));
    };

  const isCreating = !initial;

  const dirty = useMemo(() => {
    if (!initial) {
      // With no profile yet, allow save when any field is not blank.
      return Object.values(form).some((v) => (v ?? '') !== '');
    }
    const fields = Object.keys(form) as (keyof PatientUpdateIn)[];
    return fields.some(
      (k) => (form[k] ?? '') !== (initial[k as keyof PatientProfile] ?? '')
    );
  }, [form, initial]);

  // For first-time create, require DOB (DB NOT NULL)
  const dobMissing =
    isCreating && (!form.date_of_birth || String(form.date_of_birth).trim() === '');
  const canSave = dirty && !saving && (!isCreating || !dobMissing);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRefreshInfo(null);

    if (dobMissing) {
      setError('Date of birth is required to create your profile.');
      return;
    }

    setSaving(true);
    try {
      // Only send provided (non-empty) fields
      const payload: PatientUpdateIn = {};
      (Object.keys(form) as (keyof PatientUpdateIn)[]).forEach((k) => {
        const v = form[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          payload[k] = v;
        }
      });

      await api('/me/patient', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setSuccess('Profile saved.');

      // Try to refresh the profile; if it fails, keep success and show a gentle note.
      try {
        const updated = await api<PatientProfile | null>('/me/patient');
        setInitial(updated);
        setForm({
          first_name: updated?.first_name ?? '',
          middle_name: updated?.middle_name ?? '',
          last_name: updated?.last_name ?? '',
          date_of_birth: updated?.date_of_birth ?? '',
          sex: updated?.sex ?? '',
          email: updated?.email ?? '',
          phone: updated?.phone ?? '',
          address_line1: updated?.address_line1 ?? '',
          address_line2: updated?.address_line2 ?? '',
          city: updated?.city ?? '',
          state: updated?.state ?? '',
          postal_code: updated?.postal_code ?? '',
          country_code: updated?.country_code ?? 'US',
        });
      } catch {
        setRefreshInfo('Saved, but could not refresh profile. Try reloading the page.');
      }
    } catch (e: any) {
      // If the API returned validation JSON, surface that text.
      setError(e?.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Your Profile</h1>

      {loading ? (
        <LoadingSkel />
      ) : (
        <form onSubmit={onSave} className="mt-6 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {success}
            </div>
          )}
          {refreshInfo && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {refreshInfo}
            </div>
          )}

          {!initial && !success && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No profile found yet. Fill in the details below and click <b>Save</b> to create your profile.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" value={form.first_name ?? ''} onChange={onChange('first_name')} />
            <Field label="Last name" value={form.last_name ?? ''} onChange={onChange('last_name')} />
            <Field label="Middle name" value={form.middle_name ?? ''} onChange={onChange('middle_name')} />

            <Field
              label="Date of birth"
              type="date"
              value={form.date_of_birth ?? ''}
              onChange={onChange('date_of_birth')}
            />
            <Select
              label="Sex"
              value={form.sex ?? ''}
              onChange={onChange('sex')}
              options={[
                { value: '', label: '—' },
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'intersex', label: 'Intersex' },
                { value: 'other', label: 'Other' },
                { value: 'unknown', label: 'Unknown' },
              ]}
            />

            <Field label="Phone" value={form.phone ?? ''} onChange={onChange('phone')} />
            <Field label="Email" type="email" value={form.email ?? ''} onChange={onChange('email')} />
            <Field label="Address line 1" value={form.address_line1 ?? ''} onChange={onChange('address_line1')} />
            <Field label="Address line 2" value={form.address_line2 ?? ''} onChange={onChange('address_line2')} />
            <Field label="City" value={form.city ?? ''} onChange={onChange('city')} />
            <Field label="State" value={form.state ?? ''} onChange={onChange('state')} />
            <Field label="Postal code" value={form.postal_code ?? ''} onChange={onChange('postal_code')} />

            {/* Country (single component; do NOT duplicate) */}
            <div className="sm:col-span-2">
              <CountrySelect
                label="Country"
                value={form.country_code ?? 'US'}
                onChange={(code) => setForm((f) => ({ ...f, country_code: code }))}
              />
            </div>
          </div>

          {dobMissing && (
            <p className="text-sm text-red-600">Date of birth is required to create your profile.</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSave}
              className={`rounded-lg px-4 py-2 text-white ${
                !canSave ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
              } transition`}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {!dirty && <span className="text-sm text-gray-500">No changes to save</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function LoadingSkel() {
  return (
    <div className="mt-6 animate-pulse space-y-3">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  const { label, value, onChange, type = 'text', placeholder } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        type={type}
        onChange={onChange}
        placeholder={placeholder}
      />
    </label>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  const { label, value, onChange, options } = props;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-700">{label}</span>
      <select
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        value={value}
        onChange={onChange}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
