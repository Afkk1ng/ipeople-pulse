import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type RuntimeEnv = { DB: D1Database; TELEGRAM_BOT_TOKEN?: string; TELEGRAM_CHAT_ID?: string };
type QueueAction = 'approach' | 'join' | 'break' | 'freeze' | 'return';

const defaultTeam = ['Макс', 'Алина', 'Алексей', 'Коля', 'Ксюша', 'Ира', 'Арсен'];
const today = () => new Date().toISOString().slice(0, 10);
const safeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  const runtime = env as unknown as RuntimeEnv;
  try {
    const [entries, marks, setting] = await runtime.DB.batch([
      runtime.DB.prepare('SELECT employee, status FROM queue_entries ORDER BY position ASC'),
      runtime.DB.prepare('SELECT employee, COUNT(*) AS count FROM queue_approaches WHERE shift_date = ? GROUP BY employee').bind(today()),
      runtime.DB.prepare("SELECT value FROM queue_settings WHERE key = 'notifications'"),
    ]);
    const rows = entries.results as { employee: string; status: string }[];
    const queue = rows.map(row => row.employee);
    const frozenEmployees = rows.filter(row => row.status === 'frozen').map(row => row.employee);
    const approachCounts = Object.fromEntries((marks.results as { employee: string; count: number }[]).map(row => [row.employee, Number(row.count)]));
    const enabled = (setting.results as { value: number }[])[0]?.value !== 0;
    return json({ queue: queue.length ? queue : defaultTeam, frozenEmployees, approachCounts, notificationsEnabled: enabled });
  } catch { return json({ queue: defaultTeam, frozenEmployees: [], approachCounts: {}, notificationsEnabled: true }); }
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
    const updatedAt = Date.now();
    const statements = [runtime.DB.prepare('DELETE FROM queue_entries')];
    queue.forEach((employee, position) => statements.push(runtime.DB.prepare('INSERT INTO queue_entries (id, employee, position, status, updated_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), employee, position, frozenEmployees.includes(employee) ? 'frozen' : 'active', updatedAt)));
    statements.push(runtime.DB.prepare("INSERT INTO queue_settings (key, value) VALUES ('notifications', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(body.notificationsEnabled === false ? 0 : 1));
    await runtime.DB.batch(statements);
    return json({ queue, frozenEmployees, notificationsEnabled: body.notificationsEnabled !== false });
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
    const date = today();
    let count = 0;
    if (action === 'approach') {
      await runtime.DB.prepare('INSERT INTO queue_approaches (id, employee, shift_date, created_at) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), employee, date, Date.now()).run();
      const countResult = await runtime.DB.prepare('SELECT COUNT(*) AS count FROM queue_approaches WHERE employee = ? AND shift_date = ?').bind(employee, date).first<{ count: number }>();
      count = Number(countResult?.count ?? 0);
    }
    const notifications = await runtime.DB.prepare("SELECT value FROM queue_settings WHERE key = 'notifications'").first<{ value: number }>();
    if (notifications?.value !== 0 && runtime.TELEGRAM_BOT_TOKEN && runtime.TELEGRAM_CHAT_ID) {
      const actionText: Record<QueueAction, string> = {
        approach: `відмітив підхід до клієнта.\n📊 Підходів сьогодні: <b>${count}</b>`,
        join: 'став у чергу.',
        break: 'пішов на перекур і перейшов у кінець черги.',
        freeze: 'позначив робочі потреби — чергу призупинено.',
        return: 'повернувся в чергу.',
      };
      await fetch(`https://api.telegram.org/bot${runtime.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: runtime.TELEGRAM_CHAT_ID, parse_mode: 'HTML', text: `🎯 <b>Черга · iPeople PULSE</b>\n👤 <b>${safeHtml(employee)}</b> ${actionText[action]}` }) });
    }
    return json({ employee, action, count });
  } catch { return json({ error: 'Не вдалося зберегти відмітку.' }, 500); }
}
