import { sessionFor } from '@/lib/auth';

export const runtime = 'edge';

export async function GET(request: Request) {
  const session = await sessionFor(request);
  return Response.json({ authenticated: Boolean(session), username: session?.sub ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
