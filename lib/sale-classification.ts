export type SaleCategory = "Техника" | "Аксессуары" | "Услуги" | "Ремонты";

const SERVICE_WORDS = [
  "пакет послуг",
  "пакет услуг",
  "послуга",
  "услуга",
  "чистк",
  "налашту",
  "настройк",
  "перенес",
  "установк",
];
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

/**
 * iCare is written in several ways in the source reports (iCare+, i Care,
 * i-Care, Ukrainian i). Keep this detection deliberately tolerant so such
 * services never fall into the technique bucket merely because of spelling.
 */
function isNamedService(value: string) {
  const normalized = value
    .toLocaleLowerCase("uk")
    .replace(/[і]/g, "i")
    .replace(/[с]/g, "c")
    .replace(/[а]/g, "a");
  return /\bi\s*[-–—]?\s*care(?:\s*(?:\+|plus))?\b/.test(normalized)
    || /\bi\s*[-–—]?\s*start\b/.test(normalized)
    || /\bapple\s*care\s*\+?\b/.test(normalized);
}

export function categoryForSale(name: string, isService = false): SaleCategory {
  const lowered = name.trim().toLocaleLowerCase("uk");
  if (REPAIR_WORDS.some((word) => lowered.includes(word))) return "Ремонты";
  if (isService || isNamedService(name) || SERVICE_WORDS.some((word) => lowered.includes(word))) return "Услуги";
  if (TECHNIQUE_PREFIXES.some((prefix) => lowered.startsWith(prefix))) return "Техника";
  if (ACCESSORY_WORDS.some((word) => lowered.includes(word))) return "Аксессуары";
  return "Техника";
}
