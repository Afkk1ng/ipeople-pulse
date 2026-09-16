import { env } from "cloudflare:workers";

import { database } from "@/lib/database";
import { buildShiftClosingReport } from "@/lib/shift-report";
import { getMoySkladRetailShift } from "@/lib/moysklad";
import { sendTelegramHtml } from "@/lib/telegram";

type RuntimeEnv = { MYSKLAD_WEBHOOK_SECRET?: string };
type WebhookEvent = {
  action?: string;
  meta?: { href?: string; type?: string };
  href?: string;
};

function sameSecret(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index % (a.length || 1)] ?? 0) ^ (b[index % (b.length || 1)] ?? 0);
  return difference === 0;
}

function eventsFrom(value: unknown): WebhookEvent[] {
  if (Array.isArray(value)) return value as WebhookEvent[];
  if (value && typeof value === "object") {
    const payload = value as { events?: unknown } & WebhookEvent;
    if (Array.isArray(payload.events)) return payload.events as WebhookEvent[];
    return [payload];
  }
  return [];
}

export async function POST(request: Request) {
  const configured = (env as unknown as RuntimeEnv).MYSKLAD_WEBHOOK_SECRET?.trim() ?? "";
  const supplied = new URL(request.url).searchParams.get("key") ?? "";
  if (!configured || !sameSecret(configured, supplied)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ accepted: true });
  }

  const events = eventsFrom(payload).filter((event) =>
    (event.meta?.type ?? "retailshift").toLowerCase() === "retailshift" && (event.action ?? "UPDATE").toUpperCase() === "UPDATE",
  );
  if (!events.length) return Response.json({ accepted: true });

  for (const event of events) {
    const href = event.meta?.href || event.href || "";
    if (!href) continue;
    try {
      const shift = await getMoySkladRetailShift(href);
      const closedAt = shift.closeDate || shift.closeMoment || shift.closemoment || "";
      if (!shift.id || !closedAt) continue;
      const storeName = shift.retailStore?.name || shift.store?.name || shift.organization?.name || "";
      if (!/(республ|respublika)/i.test(storeName)) continue;

      const previous = await database().prepare("SELECT status FROM shift_report_deliveries WHERE shift_id = ?")
        .bind(shift.id)
        .first<{ status: string }>();
      // Only a confirmed delivery is final. A webhook retry may safely recover a
      // previous attempt that stopped while it was marked as processing.
      if (previous?.status === "sent") continue;
      await database().prepare(
        "INSERT INTO shift_report_deliveries (shift_id, shift_date, status, sent_at, payload) VALUES (?, ?, 'processing', NULL, '{}') ON CONFLICT(shift_id) DO UPDATE SET status = 'processing'",
      ).bind(shift.id, closedAt.slice(0, 10)).run();

      const report = await buildShiftClosingReport(shift);
      if (!report) {
        await database().prepare("UPDATE shift_report_deliveries SET status = 'ignored' WHERE shift_id = ?").bind(shift.id).run();
        continue;
      }
      await sendTelegramHtml(report.telegramHtml, report.telegramText);
      const reportPayload = JSON.stringify(report.details);
      await database().batch([
        database().prepare(
          "INSERT OR IGNORE INTO reports (id, employee, shift_date, submitted_at, total_pay, payload) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(`mysklad-shift-${report.shiftId}`, "Республіка · команда", report.shiftDate, Date.now(), Math.round(report.totalPayroll), reportPayload),
        database().prepare(
          "UPDATE shift_report_deliveries SET status = 'sent', sent_at = ?, payload = ? WHERE shift_id = ?",
        ).bind(Date.now(), reportPayload, report.shiftId),
      ]);
    } catch (error) {
      const id = href.split("/").filter(Boolean).at(-1) ?? "unknown";
      await database().prepare(
        "UPDATE shift_report_deliveries SET status = 'failed', payload = ? WHERE shift_id = ?",
      ).bind(JSON.stringify({ error: error instanceof Error ? error.message : "report-failed" }), id).run().catch(() => undefined);
      return Response.json({ error: "report-failed" }, { status: 503 });
    }
  }
  return Response.json({ accepted: true });
}
