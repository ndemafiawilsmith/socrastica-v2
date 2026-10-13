// The one place that names the budget-approved model and the limits the budget assumes.
// Changing the model means reviewing these numbers and the SQL reservation function together.
export const approvedModel = 'gpt-6-luna';
export const aiLimits = {
  reservationDollars: 0.01,      // reserved per attempt by reserve_mentor_request, never refunded
  allowanceDollars: 2,           // shared testing ceiling enforced in ai_budget
  dailyRequestsPerUser: 20,      // rolling 24 hours, enforced in SQL
  cooldownSeconds: 10,           // between attempts per user, enforced in SQL
  maxOutputTokens: 1000,
  providerTimeoutMs: 30000,
  maxDirectionChars: 2000,
};
export const providerUrl = 'https://api.openai.com/v1/responses';
export function aiConfigured() { return !!process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL === approvedModel; }
