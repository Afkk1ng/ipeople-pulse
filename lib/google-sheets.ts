export type SaleCategory = "Техника" | "Аксессуары" | "Услуги" | "Ремонты";

import { emptyEmployeeRules, resolveEmployee, type EmployeeRuleSet } from "@/lib/sales-import";

export type ImportedSale = {
  id: string;
  date: string;
  day: number;
  transactionId: string;
  name: string;
  category: SaleCategory;
  revenue: number;
  employee: string | null;
  employeeDetection: "name" | "color" | "conflict" | "unknown";
  sourceColor: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleCell = {
  effectiveValue?: {
    numberValue?: number;
    stringValue?: string;
    boolValue?: boolean;
  };
  formattedValue?: string;
  effectiveFormat?: {
    backgroundColorStyle?: {
      rgbColor?: { red?: number; green?: number; blue?: number };
    };
  };
};

type GoogleRow = { values?: GoogleCell[] };
type GoogleSheet = {
  properties?: { title?: string };
  data?: Array<{ rowData?: GoogleRow[] }>;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const SERVICE_WORDS = ["пакет послуг", "послуга", "чистк", "налашту", "перенес", "установк", "istart"];
const REPAIR_WORDS = ["ремонт", "repair"];
const TECHNIQUE_PREFIXES = [
  "iphone",
  "phone ",
  "watch series",
  "apple watch",
  "airpods",
  "apple macbook",
  "macbook",
  "apple ipad",
  "ipad",
  "apple imac",
  "imac",
  "ecoflow",
  "anker solix",
  "apple airtag",
  "airtag",
  "homepod",
  "apple tv",
];
const ACCESSORY_WORDS = [
  "case",
  "glass",
  "cable",
  "adapter",
  "charger",
  "charging",
  "earpods",
  "pencil",
  "folio",
  "key ring",
  "strap",
  "wire",
  "screen",
  "lens",
  "silicone",
  "cover",
  "pitaka",
  "wiwu",
  "soneex",
  "oneex",
  "proove",
  "monblan",
  "перехідник",
  "кабель",
  "чохол",
  "скло",
  "заряд",
];

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript() {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить окно входа Google."));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export async function requestSheetsAccess(clientId: string) {
  await loadGoogleIdentityScript();
  if (!window.google?.accounts.oauth2) throw new Error("Google Sign-In не загрузился.");

  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error_description || "Google не предоставил доступ к таблице."));
      },
      error_callback: () => reject(new Error("Вход в Google был закрыт или отменён.")),
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

function spreadsheetIdFromUrl(url: string) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("Вставьте полную ссылку на Google-таблицу.");
  return match[1];
}

function cellValue(row: GoogleRow | undefined, index: number) {
  const cell = row?.values?.[index];
  const value = cell?.effectiveValue;
  if (typeof value?.numberValue === "number") return value.numberValue;
  if (typeof value?.stringValue === "string") return value.stringValue;
  if (typeof value?.boolValue === "boolean") return value.boolValue;
  return cell?.formattedValue ?? null;
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fillKey(cell: GoogleCell | undefined) {
  const rgb = cell?.effectiveFormat?.backgroundColorStyle?.rgbColor;
  if (!rgb) return "none";
  const channel = (value = 0) => Math.round(value * 255).toString(16).padStart(2, "0");
  return `${channel(rgb.red)}${channel(rgb.green)}${channel(rgb.blue)}`;
}

function categoryFor(name: string): SaleCategory {
  const lowered = name.trim().toLocaleLowerCase("uk");
  if (REPAIR_WORDS.some((word) => lowered.includes(word))) return "Ремонты";
  if (SERVICE_WORDS.some((word) => lowered.includes(word))) return "Услуги";
  if (TECHNIQUE_PREFIXES.some((prefix) => lowered.startsWith(prefix))) return "Техника";
  if (ACCESSORY_WORDS.some((word) => lowered.includes(word))) return "Аксессуары";
  return "Техника";
}

function dateForSheet(raw: unknown, day: number) {
  const match = String(raw ?? "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return `2026-09-${String(day).padStart(2, "0")}`;
}

function parseSheet(sheet: GoogleSheet, employeeRules: EmployeeRuleSet): ImportedSale[] {
  const title = sheet.properties?.title ?? "";
  const day = Number.parseInt(title, 10);
  if (!Number.isFinite(day)) return [];

  const rows = sheet.data?.[0]?.rowData ?? [];
  const date = dateForSheet(cellValue(rows[0], 6), day);
  const usdUah = numeric(cellValue(rows[0], 3)) || 1;
  const eurUsd = numeric(cellValue(rows[0], 4)) || 1;

  const headerIndex = rows.findIndex(
    (row) => String(cellValue(row, 0) ?? "").trim() === "№" && String(cellValue(row, 1) ?? "").includes("Назва товару"),
  );
  if (headerIndex < 0) return [];

  let transactionNo = 0;
  let previousIndex: number | null = null;
  let previousFill = "none";
  const records: ImportedSale[] = [];

  for (let index = headerIndex + 2; index < rows.length; index += 1) {
    const row = rows[index];
    if (String(cellValue(row, 3) ?? "").trim() === "Сума:") break;

    const name = String(cellValue(row, 1) ?? "").trim();
    const code = cellValue(row, 2);
    const values = [3, 4, 5, 6, 7].map((column) => cellValue(row, column));
    const hasAmount = values.some((value) => typeof value === "number");

    if (!name || code === null || code === "" || !hasAmount) {
      previousIndex = null;
      previousFill = "none";
      continue;
    }

    const fill = fillKey(row.values?.[1]);
    const sameTransaction = fill !== "none" && previousIndex !== null && index === previousIndex + 1 && fill === previousFill;
    if (!sameTransaction) transactionNo += 1;

    const revenue =
      numeric(values[0]) +
      numeric(values[1]) * eurUsd * usdUah +
      numeric(values[2]) +
      numeric(values[3]) * usdUah +
      numeric(values[4]);

    const employee = resolveEmployee(row.values?.map(cell => cellValue({ values: [cell] }, 0)) ?? [], fill, employeeRules);
    records.push({
      id: `${title}-${index + 1}`,
      date,
      day,
      transactionId: `${date}-${String(transactionNo).padStart(2, "0")}`,
      name,
      category: categoryFor(name),
      revenue: Math.round(revenue * 100) / 100,
      employee: employee.employee,
      employeeDetection: employee.source,
      sourceColor: fill,
    });

    previousIndex = index;
    previousFill = fill;
  }

  return records;
}

async function googleJson(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Google не дал доступ. Проверьте аккаунт и доступ к таблице.");
    }
    throw new Error(`Не удалось прочитать таблицу: ${response.status}.`);
  }
  return response.json();
}

export async function importGoogleSheet(sheetUrl: string, accessToken: string, employeeRules: EmployeeRuleSet = emptyEmployeeRules()) {
  const spreadsheetId = spreadsheetIdFromUrl(sheetUrl);
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const metadata = (await googleJson(`${baseUrl}?fields=properties.title,sheets.properties`, accessToken)) as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  const dailyTitles = (metadata.sheets ?? [])
    .map((sheet) => sheet.properties?.title ?? "")
    .filter((title) => /^\d{1,2}$/.test(title))
    .sort((a, b) => Number(a) - Number(b));

  if (!dailyTitles.length) throw new Error("В таблице не найдены дневные листы с названиями 1, 2, 3…");

  const params = new URLSearchParams({ includeGridData: "true" });
  dailyTitles.forEach((title) => params.append("ranges", `'${title}'!A1:H170`));
  const workbook = (await googleJson(`${baseUrl}?${params.toString()}`, accessToken)) as { sheets?: GoogleSheet[] };
  const records = (workbook.sheets ?? []).flatMap(sheet => parseSheet(sheet, employeeRules));

  if (!records.length) throw new Error("Проданные позиции в верхних блоках отчёта не найдены.");

  return {
    records,
    title: metadata.properties?.title || "Google Sheets",
    lastDate: records.map((record) => record.date).sort().at(-1) ?? "",
    requiresReview: records.filter(record => record.employeeDetection === "unknown" || record.employeeDetection === "conflict").length,
  };
}
