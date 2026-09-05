import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type ReportPayload = {
  employee: string;
  date: string;
  total: number;
  text: string;
};

type RuntimeEnv = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID?: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  let report: ReportPayload;
  try {
    report = await request.json();
  } catch {
    return json({ error: 'Некоректний звіт.' }, 400);
  }

  if (!report.employee || !report.date || !report.text || !Number.isFinite(report.total)) {
    return json({ error: 'Заповніть дані звіту.' }, 400);
  }

  const runtime = env as unknown as RuntimeEnv;
  const id = crypto.randomUUID();
  const submittedAt = Date.now();

  await runtime.DB.prepare(
    'INSERT INTO reports (id, employee, shift_date, submitted_at, total_pay, payload) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, report.employee, report.date, submittedAt, Math.round(report.total), report.text).run();

  if (!runtime.TELEGRAM_CHAT_ID) {
    return json({ saved: true, telegramReady: false });
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${runtime.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: runtime.TELEGRAM_CHAT_ID, text: report.text }),
  });

  if (!telegramResponse.ok) {
    return json({ saved: true, telegramReady: false }, 202);
  }

  return json({ saved: true, telegramReady: true });
}
