import { env } from 'cloudflare:workers';
import { requireApiAuth } from '@/lib/auth';

export const runtime = 'edge';

type RuntimeEnv = { DB: D1Database };
type NewsState = { message: string; author: string; updatedAt: number };

const defaultNews: NewsState = {
  message: 'Нехай ця зміна буде сильною. Підтримуємо одне одного та робимо свій максимум.',
  author: 'iPeople PULSE',
  updatedAt: 0,
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

async function readNews(database: D1Database): Promise<NewsState> {
  const result = await database.prepare("SELECT message, author, updated_at FROM team_news WHERE id = 'board'").first<{ message: string; author: string; updated_at: number }>();
  return result ? { message: result.message, author: result.author, updatedAt: Number(result.updated_at) } : defaultNews;
}

export async function GET(request: Request) {
  const denied = await requireApiAuth(request); if (denied) return denied;
  try { return json(await readNews((env as unknown as RuntimeEnv).DB)); }
  catch { return json(defaultNews); }
}

export async function POST(request: Request) {
  const denied = await requireApiAuth(request); if (denied) return denied;
  let body: { message?: unknown; author?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Некоректна новина.' }, 400); }
  const message = typeof body.message === 'string' ? body.message.replace(/\r\n?/g, '\n').trim().slice(0, 360) : '';
  const author = typeof body.author === 'string' ? body.author.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
  if (!message || !author) return json({ error: 'Напишіть новину та оберіть співробітника.' }, 400);
  try {
    const database = (env as unknown as RuntimeEnv).DB;
    const updatedAt = Date.now();
    await database.prepare("INSERT INTO team_news (id, message, author, updated_at) VALUES ('board', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET message = excluded.message, author = excluded.author, updated_at = excluded.updated_at").bind(message, author, updatedAt).run();
    return json({ message, author, updatedAt });
  } catch { return json({ error: 'Не вдалося оновити дошку.' }, 500); }
}
