import { env } from 'cloudflare:workers';

export const runtime = 'edge';

type ReportPayload = {
  employee: string;
  date: string;
  total: number;
  text: string;
  telegramText?: string;
  details?: Record<string, unknown>;
};

type RuntimeEnv = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID?: string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function number(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }

export async function GET() {
  const runtime = env as unknown as RuntimeEnv;
  try {
    const result = await runtime.DB.prepare('SELECT id, employee, shift_date, total_pay, payload FROM reports ORDER BY submitted_at DESC LIMIT 100').run<{ id: string; employee: string; shift_date: string; total_pay: number; payload: string }>();
    const reports = result.results.filter(row => row.employee !== 'Технічна перевірка').map(row => {
      let details: Record<string, unknown> = {};
      try { details = JSON.parse(row.payload) as Record<string, unknown>; } catch { /* Reports created before the shared table use zeroed category details. */ }
      return { id: row.id, employee: row.employee, date: row.shift_date, base: number(details.base), tech: number(details.tech), accessories: number(details.accessories), services: number(details.services), serviceUnits: number(details.serviceUnits), repairs: number(details.repairs), bonuses: number(details.bonuses), total: row.total_pay, units: number(details.units), turnover: number(details.turnover) };
    });
    return json(reports);
  } catch { return json([], 200); }
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
  let telegramReady = false;
  if (runtime.TELEGRAM_CHAT_ID && runtime.TELEGRAM_BOT_TOKEN) {
    try {
      let telegramResponse = await fetch(`https://api.telegram.org/bot${runtime.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: runtime.TELEGRAM_CHAT_ID, text: report.telegramText || report.text, parse_mode: report.telegramText ? 'HTML' : undefined }),
      });
      if (!telegramResponse.ok && report.telegramText) telegramResponse = await fetch(`https://api.telegram.org/bot${runtime.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: runtime.TELEGRAM_CHAT_ID, text: report.text }) });
      telegramReady = telegramResponse.ok;
    } catch { telegramReady = false; }
  }

  let saved = false;
  try {
    await runtime.DB.prepare(
      'INSERT INTO reports (id, employee, shift_date, submitted_at, total_pay, payload) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), report.employee, report.date, Date.now(), Math.round(report.total), JSON.stringify(report.details ?? {})).run();
    saved = true;
  } catch { saved = false; }

  if (telegramReady) return json({ saved, telegramReady: true });
  if (saved) return json({ saved: true, telegramReady: false }, 202);
  return json({ error: 'Не вдалося передати звіт. Спробуйте ще раз.' }, 503);
}
