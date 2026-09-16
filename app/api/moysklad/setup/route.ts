import { env } from "cloudflare:workers";

import { requireApiAuth } from "@/lib/auth";
import { registerRetailShiftWebhook } from "@/lib/moysklad";

type RuntimeEnv = { MYSKLAD_WEBHOOK_SECRET?: string };
const SITE_URL = "https://ipeople-pulse.maxpysmennyi.chatgpt.site";

export async function POST(request: Request) {
  const denied = await requireApiAuth(request);
  if (denied) return denied;
  const secret = (env as unknown as RuntimeEnv).MYSKLAD_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) return Response.json({ error: "Не настроен секрет вебхука." }, { status: 503 });
  try {
    const callbackUrl = `${SITE_URL}/api/integrations/moysklad?key=${encodeURIComponent(secret)}`;
    const result = await registerRetailShiftWebhook(callbackUrl);
    return Response.json({ connected: true, created: result.created }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось подключить события смен." }, { status: 503 });
  }
}
