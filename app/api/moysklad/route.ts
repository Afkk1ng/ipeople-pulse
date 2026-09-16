import { requireApiAuth } from "@/lib/auth";
import { checkMoySklad, syncMoySklad } from "@/lib/moysklad";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const unauthorized = await requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  if (url.searchParams.get("mode") !== "sync") {
    return Response.json(await checkMoySklad(), { headers: { "Cache-Control": "no-store" } });
  }

  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isoDate.test(from) || !isoDate.test(to) || from > to) {
    return Response.json({ error: "Укажите корректный период для синхронизации." }, { status: 400 });
  }
  return Response.json(await syncMoySklad(from, to), { headers: { "Cache-Control": "no-store" } });
}
