import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSession();
  if (session?.ok) redirect('/dashboard');
  redirect('/(auth)/login');
}
