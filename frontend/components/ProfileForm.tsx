'use client';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePatientProfile } from '@/hooks/usePatientProfile';
import { api } from '@/lib/api';

const schema = z.object({
  first_name: z.string().optional(),
  middle_name: z.string().optional(),
  last_name: z.string().optional(),
  date_of_birth: z.string().optional(),
  sex: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function ProfileForm() {
  const { data, isLoading, refetch } = usePatientProfile();
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  React.useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  const onSubmit = async (values: Form) => {
    const res = await api.put('/me/patient', values);
    if (res.ok) {
      await refetch();
      alert('Saved');
    } else {
      alert('Failed to save');
    }
  };

  if (isLoading) return <div className="rounded-2xl bg-white p-6 shadow">Loading…</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl bg-white p-6 shadow space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">First name</label>
          <input className="mt-1 w-full rounded border px-3 py-2" {...register('first_name')} />
        </div>
        <div>
          <label className="block text-sm font-medium">Last name</label>
          <input className="mt-1 w-full rounded border px-3 py-2" {...register('last_name')} />
        </div>
        <div>
          <label className="block text-sm font-medium">Date of birth</label>
          <input type="date" className="mt-1 w-full rounded border px-3 py-2" {...register('date_of_birth')} />
        </div>
        <div>
          <label className="block text-sm font-medium">Sex</label>
          <select className="mt-1 w-full rounded border px-3 py-2" {...register('sex')}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input type="email" className="mt-1 w-full rounded border px-3 py-2" {...register('email')} />
        </div>
        <div>
          <label className="block text-sm font-medium">Phone</label>
          <input className="mt-1 w-full rounded border px-3 py-2" {...register('phone')} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Address</label>
          <input className="mt-1 w-full rounded border px-3 py-2 mb-2" placeholder="Address line 1" {...register('address_line1')} />
          <input className="mt-1 w-full rounded border px-3 py-2 mb-2" placeholder="Address line 2" {...register('address_line2')} />
          <div className="grid grid-cols-3 gap-2">
            <input className="rounded border px-3 py-2" placeholder="City" {...register('city')} />
            <input className="rounded border px-3 py-2" placeholder="State" {...register('state')} />
            <input className="rounded border px-3 py-2" placeholder="Postal code" {...register('postal_code')} />
          </div>
        </div>
      </div>
      <button disabled={isSubmitting} className="rounded bg-gray-900 text-white px-4 py-2">Save</button>
    </form>
  );
}
