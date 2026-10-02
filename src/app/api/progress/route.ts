import { NextRequest, NextResponse } from 'next/server';
import { serverClient, adminClient } from '@/lib/supabase/server';
import { progressSchema, welcomeMessage } from '@/lib/learning';
import { starterCode } from '@/lib/mentor';
import { readBody, sameOrigin } from '@/lib/http';
export const dynamic = 'force-dynamic';
const unavailable = () => NextResponse.json({ error: 'Saved progress is unavailable. The database may still need its migration. Please retry shortly.' }, { status: 503 });
export async function GET() {
  try {
    const db = await serverClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    const admin = adminClient();
    const { error: initError } = await admin.from('learning_sessions').upsert({ user_id: user.id, code: starterCode, messages: [welcomeMessage] }, { onConflict: 'user_id,challenge_id', ignoreDuplicates: true });
    if (initError) return unavailable();
    const { data, error } = await db.from('learning_sessions').select('code,step,unlocked,messages,reasoning_ready,reasoning_graph').eq('user_id', user.id).eq('challenge_id', 'contains-duplicate').single();
    if (error) return unavailable();
    return NextResponse.json({ ...data, step:data.reasoning_ready?data.step:Math.min(1,data.step), unlocked:data.reasoning_ready?data.unlocked:Math.min(1,data.unlocked), email: user.email }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return unavailable(); }
}
export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  try {
    const db = await serverClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to save your work.' }, { status: 401 });
    let body; try { body = progressSchema.safeParse(await readBody(request, 60000)); } catch { return NextResponse.json({ error: 'Invalid or oversized progress.' }, { status: 400 }); }
    if (!body.success) return NextResponse.json({ error: 'Invalid progress. Code must be under 50 KB.' }, { status: 400 });
    const { data, error } = await adminClient().rpc('save_learning_progress',{p_user_id:user.id,p_code:body.data.code,p_step:body.data.step,p_unlocked:body.data.unlocked});
    if (error || !data) return unavailable();
    return NextResponse.json({ saved: true });
  } catch { return unavailable(); }
}
