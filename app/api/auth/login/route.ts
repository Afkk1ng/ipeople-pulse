import { authConfigurationIsReady, issueSession, loginResponse, verifyPassword } from '@/lib/auth';

export const runtime = 'edge';

export async function POST(request: Request) {
  if (!authConfigurationIsReady()) return Response.json({ error: 'Вхід ще не налаштований.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  let body: { username?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Невірний запит.' }, { status: 400 }); }
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password || !(await verifyPassword(username, password))) return Response.json({ error: 'Невірний логін або пароль.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return loginResponse(await issueSession(username));
}
