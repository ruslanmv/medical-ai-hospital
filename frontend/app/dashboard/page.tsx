'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Loading from '@/components/Loading';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then(r => r.json()),
  });

  if (isLoading) return <Loading />;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="font-medium mb-2">Account</h2>
          <p className="text-sm text-gray-600">{data?.email}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="font-medium mb-2">Profile completeness</h2>
          <p className="text-sm text-gray-600">Go to Profile to finish your demographics.</p>
        </div>
      </div>
    </div>
  );
}
