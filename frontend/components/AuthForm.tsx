'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type Form = z.infer<typeof schema>;

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });
  const router = useRouter();

  const onSubmit = async (data: Form) => {
    const path = mode === 'login' ? '/auth/login' : '/auth/register';
    const res = await api.post(path, data);
    if (!res.ok) {
      const msg = await res.text();
      alert(msg || 'Failed');
      return;
    }
    if (mode === 'register') {
      // After registration, auto login
      await api.post('/auth/login', data);
    }
    router.push('/dashboard');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl bg-white p-6 shadow space-y-4">
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input type="email" className="mt-1 w-full rounded border px-3 py-2" {...register('email')} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium">Password</label>
        <input type="password" className="mt-1 w-full rounded border px-3 py-2" {...register('password')} />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>
      <button disabled={isSubmitting} className="rounded bg-gray-900 text-white px-4 py-2">
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}
