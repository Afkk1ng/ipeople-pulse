import { readDashboardSettings } from "@/lib/dashboard-settings";
import type { ImportedSale } from "@/lib/google-sheets";
import { syncMoySklad, type MoySkladRetailShift } from "@/lib/moysklad";
import { calculatePayroll } from "@/lib/payroll";
import { defaultRepublicPlans } from "@/lib/republic-plans";
import { emptyEmployeeRules, normalizeEmployeeText, resolveEmployee } from "@/lib/sales-import";

const money = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 0 });
const dateLabel = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" });
const timeLabel = new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Kyiv" });

function html(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function closeMoment(shift: MoySkladRetailShift) {
  return shift.closeDate || shift.closeMoment || shift.closemoment || "";
}

function parseMoySkladMoment(value: string) {
  const normalized = value.trim().replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}+03:00`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function canonicalRecords(records: ImportedSale[], employeeNames: string[], aliases = emptyEmployeeRules()) {
  const canonical = new Map(employeeNames.map((name) => [normalizeEmployeeText(name), name]));
  return records.map((sale) => {
    if (!sale.employee) return sale;
    const direct = canonical.get(normalizeEmployeeText(sale.employee));
    const resolved = resolveEmployee([sale.employee], "none", aliases).employee;
    const employee = resolved || direct || null;
    return { ...sale, employee, employeeDetection: employee ? "name" as const : "unknown" as const };
  });
}

function categoryRevenue(records: ImportedSale[], category: ImportedSale["category"]) {
  return records.filter((sale) => sale.category === category).reduce((sum, sale) => sum + sale.revenue, 0);
}

function categoryCount(records: ImportedSale[], category: ImportedSale["category"]) {
  return records.filter((sale) => sale.category === category).length;
}

function serviceKind(name: string) {
  const normalized = name.toLocaleLowerCase("uk").replace(/[і]/g, "i").replace(/[с]/g, "c").replace(/[а]/g, "a");
  if (/i\s*[-–—]?\s*care\s*(?:\+|plus)/.test(normalized)) return "iCare+";
  if (/i\s*[-–—]?\s*care/.test(normalized)) return "iCare";
  return "Інші";
}

export type ShiftClosingReport = {
  shiftId: string;
  shiftDate: string;
  totalPayroll: number;
  telegramHtml: string;
  telegramText: string;
  details: Record<string, unknown>;
};

export async function buildShiftClosingReport(shift: MoySkladRetailShift): Promise<ShiftClosingReport | null> {
  const closedAt = closeMoment(shift);
  if (!shift.id || !closedAt) return null;
  const storeName = shift.retailStore?.name || shift.store?.name || shift.organization?.name || "";
  if (!/(республ|respublika)/i.test(storeName)) return null;

  const shiftDate = closedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) return null;
  const monthStart = `${shiftDate.slice(0, 8)}01`;
  const [saved, daySource, monthSource] = await Promise.all([
    readDashboardSettings().catch(() => null),
    syncMoySklad(shiftDate, shiftDate),
    syncMoySklad(monthStart, shiftDate),
  ]);
  if (daySource.state !== "connected" || monthSource.state !== "connected") {
    throw new Error(daySource.message || monthSource.message || "Не удалось получить продажи смены.");
  }

  const plans = saved?.republicPlans ?? defaultRepublicPlans;
  const employees = plans.employees.map((employee) => employee.name);
  const aliases = saved?.employeeRules ?? emptyEmployeeRules();
  const dayRecords = canonicalRecords(daySource.records, employees, aliases);
  const monthRecords = canonicalRecords(monthSource.records, employees, aliases);
  const technique = categoryCount(dayRecords, "Техника");
  const accessories = categoryCount(dayRecords, "Аксессуары");
  const services = categoryCount(dayRecords, "Услуги");
  const accessoriesRevenue = categoryRevenue(dayRecords, "Аксессуары");
  const servicesRevenue = categoryRevenue(dayRecords, "Услуги");
  const turnover = dayRecords.reduce((sum, sale) => sum + sale.revenue, 0);
  const monthAccessories = categoryRevenue(monthRecords, "Аксессуары");
  const monthServices = categoryRevenue(monthRecords, "Услуги");
  const iCare = dayRecords.filter((sale) => sale.category === "Услуги" && serviceKind(sale.name) === "iCare").length;
  const iCarePlus = dayRecords.filter((sale) => sale.category === "Услуги" && serviceKind(sale.name) === "iCare+").length;

  const employeeRows = plans.employees.map((employee) => {
    const today = dayRecords.filter((sale) => sale.employee === employee.name);
    const month = monthRecords.filter((sale) => sale.employee === employee.name);
    const configured = saved?.payrollSettings?.[employee.name];
    const workDays = new Set(month.map((sale) => sale.date)).size;
    const payroll = calculatePayroll(employee.name, monthRecords, {
      services: configured?.servicesTarget ?? Math.round(plans.servicesTarget * employee.servicesShare),
      accessories: configured?.accessoriesTarget ?? Math.round(plans.accessoriesTarget * employee.accessoriesShare),
      storeServices: plans.servicesTarget,
      storeServicesRevenue: monthServices,
    }, {
      dailyRate: configured?.dailyRate ?? 500,
      workDays,
      focusEarnings: configured?.focusEarnings ?? 0,
      repairEarnings: configured?.repairEarnings ?? 0,
    });
    return {
      name: employee.name,
      revenue: today.reduce((sum, sale) => sum + sale.revenue, 0),
      technique: categoryCount(today, "Техника"),
      accessories: categoryCount(today, "Аксессуары"),
      services: categoryCount(today, "Услуги"),
      payroll: payroll.total,
      focusPay: payroll.focusPay,
      repairsPay: payroll.repairsPay,
      serviceRate: payroll.serviceRate,
      rows: today.length,
    };
  });
  const totalPayroll = employeeRows.reduce((sum, row) => sum + row.payroll, 0);
  const unknownRows = dayRecords.filter((sale) => !sale.employee).length;
  const closedDate = new Date(`${shiftDate}T12:00:00+03:00`);
  const closeTime = timeLabel.format(parseMoySkladMoment(closedAt) ?? closedDate);
  const servicePenetration = technique ? Math.round((services / technique) * 1000) / 10 : 0;
  const accessoryPerDevice = technique ? Math.round((accessories / technique) * 10) / 10 : 0;
  const serviceProgress = plans.servicesTarget ? Math.round(monthServices / plans.servicesTarget * 1000) / 10 : 0;
  const accessoryProgress = plans.accessoriesTarget ? Math.round(monthAccessories / plans.accessoriesTarget * 1000) / 10 : 0;

  const employeeHtml = employeeRows.filter((row) => row.rows > 0).map((row) =>
    `👤 <b>${html(row.name)}</b> · ${money.format(row.revenue)}\n   📱 ${row.technique} · 🎧 ${row.accessories} · 🛠 ${row.services}\n   💼 Послуги: ${Math.round(row.serviceRate * 100)}% · фокус ${money.format(row.focusPay)} · ремонти ${money.format(row.repairsPay)}\n   💰 ЗП за місяць: <b>${money.format(row.payroll)}</b>`,
  );
  const employeeText = employeeRows.filter((row) => row.rows > 0).map((row) =>
    `${row.name}: ${money.format(row.revenue)} · техніка ${row.technique} · акс. ${row.accessories} · послуги ${row.services} (${Math.round(row.serviceRate * 100)}%) · фокус ${money.format(row.focusPay)} · ремонти ${money.format(row.repairsPay)} · ЗП за місяць ${money.format(row.payroll)}`,
  );

  const telegramHtml = [
    "✨ <b>iPeople PULSE</b>",
    "<i>ЗВІТ ЗАКРИТТЯ ЗМІНИ · RESPUBLIKA</i>",
    "━━━━━━━━━━━━━━",
    `📅 <b>${dateLabel.format(closedDate)}</b> · ${closeTime}`,
    `🧾 Зміна: <b>${html(shift.name || shift.id)}</b>`,
    "",
    `💳 Виручка за день: <b>${money.format(turnover)}</b>`,
    `📱 Техніка: <b>${technique} шт.</b>`,
    `🎧 Аксесуари: <b>${accessories} шт.</b> · ${money.format(accessoriesRevenue)}`,
    `🛠 Послуги: <b>${services} шт.</b> · ${money.format(servicesRevenue)}`,
    `🛡 iCare: <b>${iCare}</b> · iCare+: <b>${iCarePlus}</b>`,
    `📊 Проникнення послуг: <b>${servicePenetration}%</b>`,
    `📦 Аксесуарів на техніку: <b>${accessoryPerDevice}</b>`,
    "",
    "🎯 <b>ПЛАН МАГАЗИНУ · МІСЯЦЬ</b>",
    `Послуги: ${money.format(monthServices)} / ${money.format(plans.servicesTarget)} · <b>${serviceProgress}%</b>`,
    `Аксесуари: ${money.format(monthAccessories)} / ${money.format(plans.accessoriesTarget)} · <b>${accessoryProgress}%</b>`,
    "",
    "👥 <b>КОМАНДА</b>",
    ...employeeHtml,
    unknownRows ? `⚠️ Без визначеного співробітника: <b>${unknownRows} поз.</b>` : "",
    "",
    "━━━━━━━━━━━━━━",
    `💰 <b>ЗП КОМАНДИ ЗА МІСЯЦЬ: ${money.format(totalPayroll)}</b>`,
    "⚡ <i>Джерело продажів: МойСклад · плани: окрема Google-таблиця</i>",
  ].filter(Boolean).join("\n");

  const telegramText = [
    "iPeople PULSE · звіт закриття зміни · Respublika",
    `${dateLabel.format(closedDate)} · ${closeTime} · зміна ${shift.name || shift.id}`,
    `Виручка: ${money.format(turnover)}`,
    `Техніка: ${technique}; аксесуари: ${accessories} (${money.format(accessoriesRevenue)}); послуги: ${services} (${money.format(servicesRevenue)})`,
    `iCare: ${iCare}; iCare+: ${iCarePlus}`,
    `План послуг: ${serviceProgress}%; план аксесуарів: ${accessoryProgress}%`,
    ...employeeText,
    unknownRows ? `Без визначеного співробітника: ${unknownRows}` : "",
    `ЗП команди за місяць: ${money.format(totalPayroll)}`,
  ].filter(Boolean).join("\n");

  return {
    shiftId: shift.id,
    shiftDate,
    totalPayroll,
    telegramHtml,
    telegramText,
    details: {
      source: "moysklad",
      store: "Республіка",
      shiftName: shift.name,
      closedAt,
      turnover,
      technique,
      accessories,
      accessoriesRevenue,
      services,
      servicesRevenue,
      iCare,
      iCarePlus,
      servicePenetration,
      accessoryPerDevice,
      monthServices,
      monthAccessories,
      serviceProgress,
      accessoryProgress,
      unknownRows,
      employees: employeeRows,
    },
  };
}
