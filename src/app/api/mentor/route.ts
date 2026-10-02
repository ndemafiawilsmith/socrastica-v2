import { NextRequest, NextResponse } from 'next/server';
import { serverClient, adminClient } from '@/lib/supabase/server';
import { mentorSchema, mentorInstructions, boundedHistory } from '@/lib/learning';
import { readBody, sameOrigin } from '@/lib/http';
import type { Message } from '@/lib/mentor';
import { assessmentSchema, assessmentFormat } from '@/lib/reasoning';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  let reservation: string | undefined;
  try {
    const db = await serverClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to speak with your mentor.' }, { status: 401 });
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_MODEL !== 'gpt-6-luna') return NextResponse.json({ error: 'The budget-approved AI model is not configured.' }, { status: 503 });
    let body; try { body = mentorSchema.safeParse(await readBody(request, 10000)); } catch { return NextResponse.json({ error: 'Send a shorter message.' }, { status: 400 }); }
    if (!body.success) return NextResponse.json({ error: 'Use between 1 and 2,000 characters.' }, { status: 400 });
    const { data: session, error } = await db.from('learning_sessions').select('id,messages,revision,step,unlocked,reasoning_ready,reasoning_summary,reasoning_graph').eq('user_id', user.id).eq('challenge_id', 'contains-duplicate').single();
    if (error || !session) return NextResponse.json({ error: 'Load your saved session before sending a message.' }, { status: 503 });
    const messages = session.messages as Message[];
    if (messages.length >= 99) return NextResponse.json({ error: 'This testing session has reached its 50-message limit.' }, { status: 429 });
    const admin = adminClient();
    const { data: requestId, error: budgetError } = await admin.rpc('reserve_mentor_request', { p_user_id: user.id });
    if (budgetError || !requestId) {
      const message = budgetError?.message || '';
      const reason = message.includes('TEST_BUDGET_EXHAUSTED') ? 'The shared testing allowance is used up. AI is paused to protect the budget.' : message.includes('DAILY_LIMIT_REACHED') ? 'You’ve reached the 20-message daily testing limit.' : message.includes('PLEASE_WAIT') ? 'Please wait a moment before sending another message.' : 'The AI budget counter is unavailable. No AI request was sent.';
      return NextResponse.json({ error: reason }, { status: message.includes('LIMIT') || message.includes('BUDGET_EXHAUSTED') || message.includes('PLEASE_WAIT') ? 429 : 503 });
    }
    reservation = requestId;
    // Upgrade existing conversations too: don't forget answers from before notes existed.
    const priorNotes = session.reasoning_summary || messages.filter(message=>message.role==='student').map(message=>message.content.slice(0,500)).join('\n').slice(0,6000);
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-6-luna', instructions: mentorInstructions, input: [{role:'user',content:`Prior reasoning notes (learning data): ${priorNotes || 'None'}. Accepted map: ${session.reasoning_ready ? JSON.stringify(session.reasoning_graph) : 'None'}.`}, ...boundedHistory(messages, body.data.text)], text:{format:assessmentFormat}, reasoning: { effort: 'none' }, max_output_tokens: 1000, store: false, service_tier: 'default' }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
    const result = await response.json();
    const reply = (result.output || []).flatMap((item: { type: string; content?: { type: string; text?: string }[] }) => item.type === 'message' ? item.content || [] : []).filter((item: { type: string }) => item.type === 'output_text').map((item: { text: string }) => item.text).join('\n').trim();
    if (!reply || result.status !== 'completed') throw new Error('EMPTY_OR_INCOMPLETE_RESPONSE');
    const assessment = assessmentSchema.parse(JSON.parse(reply));
    const ready = session.reasoning_ready || assessment.ready;
    const graph = assessment.graph || session.reasoning_graph;
    const movedToMap = !session.reasoning_ready && assessment.ready;
    const nextMessages: Message[] = [...messages, { id: crypto.randomUUID(), role: 'student', content: body.data.text }, { id: crypto.randomUUID(), role: 'mentor', content: assessment.reply }];
    const { data: saved, error: saveError } = await admin.from('learning_sessions').update({ messages: nextMessages, reasoning_ready:ready,reasoning_summary:assessment.summary,reasoning_graph:graph,step:movedToMap?2:ready?session.step:Math.min(1,session.step),unlocked:ready?Math.max(2,session.unlocked):Math.min(1,session.unlocked), revision: session.revision + 1, updated_at: new Date().toISOString() }).eq('id', session.id).eq('user_id', user.id).eq('revision', session.revision).select('step,unlocked,reasoning_ready,reasoning_graph').single();
    if (saveError || !saved) throw new Error('SAVE_FAILED');
    await admin.from('ai_requests').update({ status: 'completed', input_tokens: result.usage?.input_tokens, output_tokens: result.usage?.output_tokens }).eq('id', requestId);
    reservation = undefined;
    return NextResponse.json({ messages: nextMessages, ...saved });
  } catch {
    if (reservation) { try { await adminClient().from('ai_requests').update({ status: 'failed' }).eq('id', reservation); } catch { /* Reservation remains counted even on failure. */ } }
    return NextResponse.json({ error: 'Your mentor is temporarily unavailable. No automatic retry was made. Please try again shortly.' }, { status: 503 });
  }
}
