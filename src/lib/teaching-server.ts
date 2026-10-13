import 'server-only';
import { adminClient } from './supabase/server';
import { blueprintKey, type Blueprint } from './blueprint';
import { StudioError } from './studio-ai';
import type { Classroom, Feedback } from './classroom';

// The class a session belongs to, with the student's view of its settings and feedback.
export async function learningContext(userId: string, classroomId: string | null): Promise<{ classroom: Classroom | null; feedback: Feedback | null }> {
  if (!classroomId) return { classroom: null, feedback: null };
  const admin = adminClient();
  const member = await admin.from('classroom_members').select('user_id').eq('classroom_id', classroomId).eq('user_id', userId).eq('active', true).maybeSingle();
  if (member.error) throw new StudioError('Class membership is unavailable.');
  if (!member.data) return { classroom: null, feedback: null };
  const classroom = await admin.from('classrooms').select('id,name,hint_depth,require_prediction,allow_code').eq('id', classroomId).single();
  if (classroom.error) throw new StudioError('Your class settings could not load.');
  const feedback = await admin.from('classroom_feedback').select('note,rubric').eq('classroom_id', classroomId).eq('user_id', userId).maybeSingle();
  if (feedback.error) throw new StudioError('Instructor feedback could not load.');
  return { classroom: classroom.data, feedback: feedback.data };
}

// Server-side checks before any AI spending on code: no recorded counterexample on this
// exact graph, and the class policy (drafting allowed, prediction required) is satisfied.
export async function enforceDraftPolicy(userId: string, challengeId: string, graph: Blueprint, classroomId: string | null) {
  const admin = adminClient();
  const failures = await admin.from('studio_events').select('id').eq('user_id', userId).eq('challenge_id', challengeId).eq('kind', 'simulation').eq('detail->>graphKey', blueprintKey(graph)).eq('detail->>passed', 'false').limit(1);
  if (failures.error) throw new StudioError('Your experiment evidence could not be checked.');
  if (failures.data?.length) throw new StudioError('A saved experiment found a failing input on this blueprint. Repair the logic before drafting.', 422);
  const { classroom } = await learningContext(userId, classroomId);
  if (!classroom) return;
  if (!classroom.allow_code) throw new StudioError('Your instructor has paused code drafting for this activity. You can keep exploring the blueprint.', 403);
  if (classroom.require_prediction) {
    const result = await admin.from('studio_events').select('id').eq('user_id', userId).eq('classroom_id', classroom.id).eq('challenge_id', challengeId).eq('kind', 'prediction').eq('detail->>graphKey', blueprintKey(graph)).eq('detail->>correct', 'true').limit(1);
    if (result.error) throw new StudioError('Your prediction evidence could not be checked.');
    if (!result.data?.length) throw new StudioError('Predict one branch correctly on this blueprint before drafting code.', 422);
  }
}

export async function recordEvent(userId: string, challengeId: string, kind: string, detail: Record<string, unknown>, blueprint: Blueprint | null = null, expectedRevision: number | null = null) {
  const result = await adminClient().rpc('record_studio_event', { p_user_id: userId, p_challenge_id: challengeId, p_kind: kind, p_detail: detail, p_blueprint: blueprint, p_expected_revision: expectedRevision });
  if (result.error?.message.includes('REVISION_CONFLICT')) throw new StudioError('Your blueprint changed. Repeat the activity on the saved version.', 409);
  if (result.error) throw new StudioError(result.error.message.includes('EVENT_LIMIT') ? 'Your learning journal reached its daily activity limit. Try again tomorrow.' : 'Your learning evidence could not be saved.', result.error.message.includes('EVENT_LIMIT') ? 429 : 503);
  return result.data as string;
}
