import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/studio');
  return children;
}
