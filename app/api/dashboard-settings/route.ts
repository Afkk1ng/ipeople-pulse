import { requireApiAuth } from "@/lib/auth";
import { readDashboardSettings, saveDashboardSettings, type SavedDashboardSettings } from "@/lib/dashboard-settings";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;
  return json(await readDashboardSettings());
}

export async function POST(request: Request) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;
  let body: SavedDashboardSettings;
  try {
    body = await request.json() as SavedDashboardSettings;
  } catch {
    return json({ error: "Некорректные настройки." }, 400);
  }
  if (!body?.republicPlans?.employees?.length || !body.employeeRules || !body.payrollSettings) {
    return json({ error: "Не хватает данных планов." }, 400);
  }
  await saveDashboardSettings(body);
  return json({ saved: true });
}
