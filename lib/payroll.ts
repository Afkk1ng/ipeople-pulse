import type { ImportedSale } from "@/lib/google-sheets";

export type PayrollSettings = { dailyRate: number; workDays: number };

export type PayrollResult = {
  employee: string;
  servicesRevenue: number;
  accessoriesRevenue: number;
  techUnits: number;
  serviceProgress: number;
  accessoriesProgress: number;
  basePay: number;
  techPay: number;
  accessoriesPay: number;
  servicesPay: number;
  repairsPay: number;
  total: number;
  attributedRows: number;
};

function accessoryRate(sale: ImportedSale, progress: number) {
  const tier = progress >= 1 ? 2 : progress >= 0.7 ? 1 : 0;
  const glass = /скло|плівк|glass|tempered|anti peep/i.test(sale.name);
  if (glass) return [0.08, 0.09, 0.1][tier];
  if (sale.revenue <= 1000) return [0.1, 0.12, 0.14][tier];
  if (sale.revenue <= 3000) return [0.03, 0.05, 0.07][tier];
  return [0.02, 0.03, 0.04][tier];
}

function techUnitRate(name: string) {
  if (/used|вживан|б\/?у/i.test(name)) return 160;
  if (/open box|open-box/i.test(name)) return 120;
  if (/airtag|homepod|apple tv|ecoflow|anker|periphery|перифер/i.test(name)) return 50;
  return 80;
}

function serviceRate(progress: number) {
  if (progress >= 1.5) return 0.35;
  if (progress >= 1.2) return 0.3;
  if (progress >= 1) return 0.25;
  return 0.2;
}

/** The rate grid is the legacy iPeople Plus motivation logic. */
export function calculatePayroll(
  employee: string,
  rows: ImportedSale[],
  targets: { services: number; accessories: number },
  settings: PayrollSettings,
): PayrollResult {
  const owned = rows.filter((sale) => sale.employee === employee);
  const services = owned.filter((sale) => sale.category === "Услуги");
  const accessories = owned.filter((sale) => sale.category === "Аксессуары");
  const tech = owned.filter((sale) => sale.category === "Техника");
  const repairs = owned.filter((sale) => sale.category === "Ремонты");
  const servicesRevenue = services.reduce((sum, sale) => sum + sale.revenue, 0);
  const accessoriesRevenue = accessories.reduce((sum, sale) => sum + sale.revenue, 0);
  const serviceProgress = targets.services > 0 ? servicesRevenue / targets.services : 0;
  const accessoriesProgress = targets.accessories > 0 ? accessoriesRevenue / targets.accessories : 0;
  const techPay = tech.reduce((sum, sale) => sum + techUnitRate(sale.name), 0);
  const accessoriesPay = accessories.reduce((sum, sale) => sum + Math.round(sale.revenue * accessoryRate(sale, accessoriesProgress)), 0);
  const servicesPay = Math.round(servicesRevenue * serviceRate(serviceProgress));
  // Legacy rule pays 5% from repair profit. Sales data contains revenue only,
  // so repairs remain excluded until profit is entered in a future import.
  const repairsPay = repairs.length ? 0 : 0;
  const basePay = Math.max(0, settings.dailyRate) * Math.max(0, settings.workDays);
  return {
    employee,
    servicesRevenue,
    accessoriesRevenue,
    techUnits: tech.length,
    serviceProgress,
    accessoriesProgress,
    basePay,
    techPay,
    accessoriesPay,
    servicesPay,
    repairsPay,
    total: basePay + techPay + accessoriesPay + servicesPay + repairsPay,
    attributedRows: owned.length,
  };
}
