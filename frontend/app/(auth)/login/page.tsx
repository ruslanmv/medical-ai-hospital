'use client';
import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <div className="container-narrow">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <AuthForm mode="login" />
    </div>
  );
}
