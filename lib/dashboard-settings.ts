import { database } from "@/lib/database";
import type { RepublicPlans } from "@/lib/republic-plans";
import type { EmployeeRuleSet } from "@/lib/sales-import";
import type { PayrollSettings } from "@/lib/payroll";

export type SavedDashboardSettings = {
  republicPlans: RepublicPlans;
  payrollSettings: Record<string, PayrollSettings & { servicesTarget: number; accessoriesTarget: number }>;
  employeeRules: EmployeeRuleSet;
};

const SETTINGS_KEY = "republic_dashboard";

export async function saveDashboardSettings(settings: SavedDashboardSettings) {
  await database().prepare(
    "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).bind(SETTINGS_KEY, JSON.stringify(settings), Date.now()).run();
}

export async function readDashboardSettings() {
  const row = await database().prepare("SELECT value FROM app_settings WHERE key = ?")
    .bind(SETTINGS_KEY)
    .first<{ value: string }>();
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as SavedDashboardSettings;
  } catch {
    return null;
  }
}
