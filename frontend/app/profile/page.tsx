'use client';
import ProfileForm from '@/components/ProfileForm';

export default function ProfilePage() {
  return (
    <div className="container-narrow">
      <h1 className="text-2xl font-semibold mb-4">Your profile</h1>
      <ProfileForm />
    </div>
  );
}
