'use client';
import AuthForm from '@/components/AuthForm';

export default function RegisterPage() {
  return (
    <div className="container-narrow">
      <h1 className="text-2xl font-semibold mb-4">Create account</h1>
      <AuthForm mode="register" />
    </div>
  );
}
