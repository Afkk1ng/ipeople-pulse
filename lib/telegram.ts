import { env } from "cloudflare:workers";

type RuntimeEnv = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
};

export async function sendTelegramHtml(html: string, fallbackText: string) {
  const runtime = env as unknown as RuntimeEnv;
  if (!runtime.TELEGRAM_BOT_TOKEN || !runtime.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram-бот не настроен.");
  }

  const endpoint = `https://api.telegram.org/bot${runtime.TELEGRAM_BOT_TOKEN}/sendMessage`;
  let response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: runtime.TELEGRAM_CHAT_ID, text: html, parse_mode: "HTML" }),
  });
  if (!response.ok) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: runtime.TELEGRAM_CHAT_ID, text: fallbackText }),
    });
  }
  if (!response.ok) throw new Error("Telegram не принял отчёт.");
}
