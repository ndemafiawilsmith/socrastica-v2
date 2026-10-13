import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
export default async function InstructorLayout({children}:{children:React.ReactNode}){
  const db=await serverClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login?next=/instructor');return children;
}
