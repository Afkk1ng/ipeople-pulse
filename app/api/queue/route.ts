import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type RuntimeEnv = { DB: D1Database; TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string };
type QueueAction = 'approach' | 'join' | 'break' | 'freeze' | 'return';
type QueueState = { queue: string[]; frozenEmployees: string[]; approachCounts: Record<string, number>; notificationsEnabled: boolean };

const defaultTeam = ['Макс', 'Алина', 'Алексей', 'Коля', 'Ксюша', 'Ира', 'Арсен'];
const today = () => new Date().toISOString().slice(0, 10);
const safeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const corsHeaders = { 'Access-Control-Allow-Origin': 'https://afkk1ng.github.io', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...corsHeaders } });
export function OPTIONS() { return new Response(null, { status: 204, headers: corsHeaders }); }

async function readQueueState(database: D1Database): Promise<QueueState> {
  const [entries, marks, setting] = await database.batch([
    database.prepare('SELECT employee, status FROM queue_entries ORDER BY position ASC'),
    database.prepare('SELECT employee, COUNT(*) AS count FROM queue_approaches WHERE shift_date = ? GROUP BY employee').bind(today()),
    database.prepare("SELECT value FROM queue_settings WHERE key = 'notifications'"),
  ]);
  const rows = entries.results as { employee: string; status: string }[];
  const queue = rows.map(row => row.employee);
  return {
    queue: queue.length ? queue : defaultTeam,
    frozenEmployees: rows.filter(row => row.status === 'frozen').map(row => row.employee),
    approachCounts: Object.fromEntries((marks.results as { employee: string; count: number }[]).map(row => [row.employee, Number(row.count)])),
    notificationsEnabled: (setting.results as { value: number }[])[0]?.value !== 0,
  };
}

async function writeQueueState(database: D1Database, queue: string[], frozenEmployees: string[], notificationsEnabled: boolean, beforeWrite: D1PreparedStatement[] = []) {
  const updatedAt = Date.now();
  const frozen = new Set(frozenEmployees);
  const statements: D1PreparedStatement[] = [...beforeWrite, database.prepare('DELETE FROM queue_entries')];
  queue.forEach((employee, position) => statements.push(database.prepare('INSERT INTO queue_entries (id, employee, position, status, updated_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), employee, position, frozen.has(employee) ? 'frozen' : 'active', updatedAt)));
  statements.push(database.prepare("INSERT INTO queue_settings (key, value) VALUES ('notifications', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(notificationsEnabled ? 1 : 0));
  await database.batch(statements);
}

export async function GET() {
  const runtime = env as unknown as RuntimeEnv;
  try { return json(await readQueueState(runtime.DB)); }
  catch { return json({ queue: defaultTeam, frozenEmployees: [], approachCounts: {}, notificationsEnabled: true }); }
}

export async function PUT(request: Request) {
  let body: { queue?: unknown; notificationsEnabled?: unknown; frozenEmployees?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Некоректна черга.' }, 400); }
  const queue = Array.isArray(body.queue) ? body.queue.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean).slice(0, 30) : [];
  if (!queue.length || new Set(queue.map(name => name.toLocaleLowerCase())).size !== queue.length) return json({ error: 'Додайте хоча б одного співробітника без повторів.' }, 400);
  const requestedFrozen = Array.isArray(body.frozenEmployees) ? body.frozenEmployees.filter((name): name is string => typeof name === 'string').map(name => name.trim().toLocaleLowerCase()) : [];
  const frozenEmployees = queue.filter(employee => requestedFrozen.includes(employee.toLocaleLowerCase()));
  const runtime = env as unknown as RuntimeEnv;
  try {
    await writeQueueState(runtime.DB, queue, frozenEmployees, body.notificationsEnabled !== false);
    return json(await readQueueState(runtime.DB));
  } catch { return json({ error: 'Не вдалося зберегти чергу.' }, 500); }
}

export async function POST(request: Request) {
  let body: { employee?: unknown; action?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Некоректна відмітка.' }, 400); }
  const employee = typeof body.employee === 'string' ? body.employee.trim() : '';
  const action: QueueAction = body.action === 'join' || body.action === 'break' || body.action === 'freeze' || body.action === 'return' ? body.action : 'approach';
  if (!employee) return json({ error: 'Оберіть співробітника.' }, 400);
  const runtime = env as unknown as RuntimeEnv;
  try {
    const state = await readQueueState(runtime.DB);
    let queue = [...state.queue];
    let frozenEmployees = [...state.frozenEmployees];
    if (!queue.includes(employee)) queue.push(employee);
    if (action === 'approach' || action === 'join' || action === 'break' || action === 'return') {
      queue = [...queue.filter(name => name !== employee), employee];
      frozenEmployees = frozenEmployees.filter(name => name !== employee);
    }
    if (action === 'freeze' && !frozenEmployees.includes(employee)) frozenEmployees.push(employee);
    const date = today();
    let count = 0;
    const beforeWrite: D1PreparedStatement[] = [];
    if (action === 'approach') {
      beforeWrite.push(runtime.DB.prepare('INSERT INTO queue_approaches (id, employee, shift_date, created_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), employee, date, Date.now()));
    }
    await writeQueueState(runtime.DB, queue, frozenEmployees, state.notificationsEnabled, beforeWrite);
    const nextState = await readQueueState(runtime.DB);
    count = nextState.approachCounts[employee] ?? 0;
    if (nextState.notificationsEnabled && runtime.TELEGRAM_BOT_TOKEN && runtime.TELEGRAM_CHAT_ID) {
      const actionText: Record<QueueAction, string> = {
        approach: `відмітив підхід до клієнта.\n📊 Підходів сьогодні: <b>${count}</b>`,
        join: 'став у чергу.',
        break: 'пішов на перекур і перейшов у кінець черги.',
        freeze: 'позначив робочі потреби — чергу призупинено.',
        return: 'повернувся в чергу.',
      };
      await fetch(`https://api.telegram.org/bot${runtime.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: runtime.TELEGRAM_CHAT_ID, parse_mode: 'HTML', text: `🎯 <b>Черга · iPeople PULSE</b>\n👤 <b>${safeHtml(employee)}</b> ${actionText[action]}` }) });
    }
    return json({ ...nextState, employee, action, count });
  } catch { return json({ error: 'Не вдалося зберегти відмітку.' }, 500); }
}
