'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});
type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Call the gateway /auth/login with fetch so we can inspect status codes.
 * Throws an Error with a `status` property on non-2xx.
 */
async function loginRequest(data: LoginFormValues): Promise<void> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  // try to surface backend message if present
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const err = new Error(text || `Request failed: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  // success -> cookies set by Set-Cookie
}

export default function LoginPage() {
  const { toast } = useToast();
  const [showForgot, setShowForgot] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: LoginFormValues) => loginRequest(data),
    onSuccess: () => {
      // redirect after cookie is set
      window.location.href = '/profile';
    },
    onError: (error: any) => {
      // Show “forgot password” ONLY when credentials are wrong (401)
      if (error?.status === 401) {
        setShowForgot(true);
        toast({
          variant: 'destructive',
          title: 'Invalid email or password',
          description: 'Please check your credentials.',
        });
      } else {
        setShowForgot(false);
        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: error?.message || 'An unexpected error occurred.',
        });
      }
    },
  });

  const onSubmit = (data: LoginFormValues) => mutation.mutate(data);
  const emailValue = form.watch('email');

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to continue to Hospital AI.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full mt-2" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>

            {showForgot && (
              <p className="mt-3 text-center text-sm text-slate-600">
                Forgot your password?{' '}
                <Link
                  className="text-indigo-600 hover:underline"
                  href={
                    emailValue
                      ? `/forgot-password?email=${encodeURIComponent(emailValue)}`
                      : '/forgot-password'
                  }
                >
                  Reset it here
                </Link>
                .
              </p>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              No account?{' '}
              <Link href="/register" className="text-indigo-600 hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
