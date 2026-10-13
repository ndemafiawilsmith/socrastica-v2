import { z } from 'zod';
export const classSettingsSchema = z.object({ hint_depth: z.number().int().min(0).max(2), require_prediction: z.boolean(), allow_code: z.boolean() }).strict();
export type ClassSettings = z.infer<typeof classSettingsSchema>;
export type Classroom = ClassSettings & { id: string; name: string; join_code?: string };
export type LearningEvent = { id: string; kind: string; detail: Record<string, unknown>; blueprint: import('./blueprint').Blueprint | null; created_at: string; revision: number };
export const eventNames: Record<string, string> = { blueprint_saved: 'Blueprint revised', ai_direction: 'AI draft requested', code_verified: 'Code verified', prediction: 'Branch predicted', reflection: 'Reasoning explained', simulation: 'Experiment recorded', hint: 'Guidance explored', joined: 'Joined class' };
export const rubricSchema = z.object({ memory: z.enum(['unreviewed','developing','understood']), branching: z.enum(['unreviewed','developing','understood']), edge_cases: z.enum(['unreviewed','developing','understood']) }).strict();
export type Rubric = z.infer<typeof rubricSchema>;
export type Feedback = { note: string; rubric: Rubric };
