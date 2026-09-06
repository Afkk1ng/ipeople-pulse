import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type RuntimeEnv = { DB: D1Database };
type Mood = 'low' | 'okay' | 'great';
const moods: Mood[] = ['low', 'okay', 'great'];
const today = () => new Date().toISOString().slice(0, 10);
const corsHeaders = { 'Access-Control-Allow-Origin': 'https://afkk1ng.github.io', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...corsHeaders } });
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

async function currentMoodState(database: D1Database) {
  const rows = await database.prepare('SELECT employee, mood FROM team_moods WHERE shift_date = ?').bind(today()).run<{ employee: string; mood: Mood }>();
  const counts: Record<Mood, number> = { low: 0, okay: 0, great: 0 };
  const employeeMoods: Record<string, Mood> = {};
  rows.results.forEach(row => { if (moods.includes(row.mood)) { employeeMoods[row.employee] = row.mood; counts[row.mood] += 1; } });
  return { moods: employeeMoods, counts };
}

export async function GET() {
  try { return json(await currentMoodState((env as unknown as RuntimeEnv).DB)); }
  catch { return json({ moods: {}, counts: { low: 0, okay: 0, great: 0 } }); }
}

export async function POST(request: Request) {
  let body: { employee?: unknown; mood?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Некоректний настрій.' }, 400); }
  const employee = typeof body.employee === 'string' ? body.employee.trim().slice(0, 80) : '';
  const mood = typeof body.mood === 'string' && moods.includes(body.mood as Mood) ? body.mood as Mood : null;
  if (!employee || !mood) return json({ error: 'Оберіть співробітника та настрій.' }, 400);
  try {
    const database = (env as unknown as RuntimeEnv).DB;
    await database.prepare('INSERT INTO team_moods (employee, shift_date, mood, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(employee, shift_date) DO UPDATE SET mood = excluded.mood, updated_at = excluded.updated_at').bind(employee, today(), mood, Date.now()).run();
    return json(await currentMoodState(database));
  } catch { return json({ error: 'Не вдалося зберегти настрій.' }, 500); }
}
