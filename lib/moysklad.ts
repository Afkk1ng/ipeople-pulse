import { env } from "cloudflare:workers";

import type { ImportedSale } from "@/lib/google-sheets";
import { categoryForSale } from "@/lib/sale-classification";

type RuntimeEnv = { MYSKLAD_ACCESS_TOKEN?: string };
type ConnectionState = "connected" | "missing_token" | "unavailable";

type NamedEntity = { name?: string; fullName?: string; meta?: { type?: string } };
type Attribute = { name?: string; value?: string | number | boolean | NamedEntity | null };
type Position = {
  id?: string;
  quantity?: number;
  price?: number;
  sum?: number;
  discount?: number;
  assortment?: NamedEntity;
};
type Demand = {
  id?: string;
  name?: string;
  moment?: string;
  applicable?: boolean;
  store?: NamedEntity;
  retailStore?: NamedEntity;
  organization?: NamedEntity;
  owner?: NamedEntity;
  state?: NamedEntity;
  attributes?: Attribute[];
  positions?: { rows?: Position[] };
};
type DemandResponse = { rows?: Demand[]; meta?: { size?: number } };

export type MoySkladRetailShift = {
  id?: string;
  name?: string;
  moment?: string;
  openDate?: string;
  closeDate?: string;
  closeMoment?: string;
  closemoment?: string;
  retailStore?: NamedEntity;
  store?: NamedEntity;
  organization?: NamedEntity;
};

export type MoySkladConnection = {
  state: ConnectionState;
  message: string;
  checkedAt: string;
};

export type MoySkladSync = MoySkladConnection & {
  records: ImportedSale[];
  truncated?: boolean;
};

const API_BASE = "https://api.moysklad.ru/api/remap/1.2";
const REPUBLICA_NAME = /(республ|respublika)/i;
const EMPLOYEE_FIELD = /(сотрудник|продавец|менеджер|employee|seller)/i;
const PAGE_SIZE = 100;
const MAX_DOCUMENTS = 3_000;

function accessToken() {
  return (env as unknown as RuntimeEnv).MYSKLAD_ACCESS_TOKEN?.trim() ?? "";
}

function missingToken(): MoySkladConnection {
  return {
    state: "missing_token",
    message: "Нет защищённого доступа к МойСклад.",
    checkedAt: new Date().toISOString(),
  };
}

function unavailable(message = "МойСклад сейчас не отвечает."): MoySkladConnection {
  return { state: "unavailable", message, checkedAt: new Date().toISOString() };
}

function connected(): MoySkladConnection {
  return { state: "connected", message: "МойСклад подключён — данные обновляются.", checkedAt: new Date().toISOString() };
}

async function requestMoySklad<T>(url: URL, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json;charset=utf-8",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("МойСклад не принял доступ. Проверьте токен.");
    }
    throw new Error(`МойСклад временно недоступен (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

function demandUrl(from: string, to: string, offset: number, limit = PAGE_SIZE) {
  const url = new URL(`${API_BASE}/entity/retaildemand`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("order", "moment,desc");
  url.searchParams.set("expand", "positions.assortment,store,organization,owner,state,retailStore");
  url.searchParams.set("filter", `moment>=${from} 00:00:00;moment<=${to} 23:59:59`);
  return url;
}

function isRepublicaDemand(demand: Demand) {
  return [demand.retailStore?.name, demand.store?.name, demand.organization?.name]
    .filter(Boolean)
    .some((name) => REPUBLICA_NAME.test(name ?? ""));
}

function employeeFor(demand: Demand) {
  const customValue = demand.attributes?.find((attribute) => EMPLOYEE_FIELD.test(attribute.name ?? ""))?.value;
  if (typeof customValue === "string" && customValue.trim()) return customValue.trim();
  if (customValue && typeof customValue === "object") {
    const namedValue = customValue.name?.trim() || customValue.fullName?.trim();
    if (namedValue) return namedValue;
  }
  return demand.owner?.fullName?.trim() || demand.owner?.name?.trim() || null;
}

function dateFor(moment: string | undefined) {
  const match = moment?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? new Date().toISOString().slice(0, 10);
}

function salesForDemand(demand: Demand): ImportedSale[] {
  if (!demand.id || demand.applicable === false || !isRepublicaDemand(demand)) return [];
  const date = dateFor(demand.moment);
  const employee = employeeFor(demand);
  const positions = demand.positions?.rows ?? [];
  return positions.flatMap((position, positionIndex) => {
    const name = position.assortment?.name?.trim() || "Без названия";
    const quantity = Math.max(1, Math.round(Number(position.quantity) || 1));
    const listedPrice = Number(position.price ?? 0);
    const discount = Math.min(100, Math.max(0, Number(position.discount) || 0));
    const unitTotal = position.sum != null
      ? Number(position.sum) / quantity
      : listedPrice * (1 - discount / 100);
    const revenue = Math.round((unitTotal / 100) * 100) / 100;
    const category = categoryForSale(name, position.assortment?.meta?.type === "service");
    return Array.from({ length: quantity }, (_, unit) => ({
      id: `moysklad-${demand.id}-${position.id ?? positionIndex}-${unit}`,
      date,
      day: Number(date.slice(-2)),
      transactionId: demand.name || demand.id,
      name,
      category,
      revenue,
      employee,
      employeeDetection: employee ? "name" : "unknown",
      sourceColor: "none",
    }));
  });
}

export async function checkMoySklad(): Promise<MoySkladConnection> {
  const token = accessToken();
  if (!token) return missingToken();
  try {
    const url = new URL(`${API_BASE}/entity/retaildemand`);
    url.searchParams.set("limit", "1");
    await requestMoySklad<DemandResponse>(url, token);
    return connected();
  } catch (error) {
    return unavailable(error instanceof Error ? error.message : undefined);
  }
}

export async function syncMoySklad(from: string, to: string): Promise<MoySkladSync> {
  const token = accessToken();
  if (!token) return { ...missingToken(), records: [] };

  try {
    const documents: Demand[] = [];
    let total = Infinity;
    for (let offset = 0; offset < total && offset < MAX_DOCUMENTS; offset += PAGE_SIZE) {
      const page = await requestMoySklad<DemandResponse>(demandUrl(from, to, offset), token);
      const rows = page.rows ?? [];
      documents.push(...rows);
      total = page.meta?.size ?? rows.length;
      if (rows.length < PAGE_SIZE) break;
    }
    return {
      ...connected(),
      records: documents.flatMap(salesForDemand),
      truncated: total > MAX_DOCUMENTS,
    };
  } catch (error) {
    return { ...unavailable(error instanceof Error ? error.message : undefined), records: [] };
  }
}

function verifiedEntityUrl(href: string, entity: string) {
  const url = new URL(href);
  const allowedHost = url.hostname === "api.moysklad.ru" || url.hostname === "online.moysklad.ru";
  const allowedPath = url.pathname.startsWith(`/api/remap/1.2/entity/${entity}/`);
  if (url.protocol !== "https:" || !allowedHost || !allowedPath) throw new Error("Некорректная ссылка МойСклад.");
  return url;
}

export async function getMoySkladRetailShift(href: string) {
  const token = accessToken();
  if (!token) throw new Error("Нет доступа к МойСклад.");
  const url = verifiedEntityUrl(href, "retailshift");
  url.searchParams.set("expand", "retailStore,store,organization");
  return requestMoySklad<MoySkladRetailShift>(url, token);
}

type WebhookRow = { id?: string; url?: string; action?: string; entityType?: string };

export async function registerRetailShiftWebhook(callbackUrl: string) {
  const token = accessToken();
  if (!token) throw new Error("Сначала подключите токен МойСклад.");
  const listUrl = new URL(`${API_BASE}/entity/webhook`);
  const existing = await requestMoySklad<{ rows?: WebhookRow[] }>(listUrl, token);
  const found = existing.rows?.find((row) => row.url === callbackUrl && row.action === "UPDATE" && row.entityType?.toLowerCase() === "retailshift");
  if (found?.id) return { id: found.id, created: false };

  const created = await requestMoySklad<WebhookRow>(listUrl, token, {
    method: "POST",
    body: JSON.stringify({ url: callbackUrl, action: "UPDATE", entityType: "retailshift" }),
  });
  if (!created.id) throw new Error("МойСклад не создал вебхук смены.");
  return { id: created.id, created: true };
}
