import type { ImportedSale } from "@/lib/google-sheets";

export type PayrollSettings = {
  dailyRate: number;
  workDays: number;
  focusEarnings: number;
  repairEarnings: number;
};

export type PayrollTargets = {
  services: number;
  accessories: number;
  storeServices: number;
  storeServicesRevenue: number;
};

export type PayrollResult = {
  employee: string;
  servicesRevenue: number;
  accessoriesRevenue: number;
  techUnits: number;
  serviceUnits: number;
  serviceConversion: number;
  serviceRate: number;
  storeServicePlanMet: boolean;
  serviceProgress: number;
  accessoriesProgress: number;
  basePay: number;
  techPay: number;
  accessoriesPay: number;
  servicesPay: number;
  focusPay: number;
  repairsPay: number;
  total: number;
  attributedRows: number;
};

function accessoryRate(sale: ImportedSale, progress: number) {
  // Legacy iPeople Plus tiers: below 70%, 70–100%, and strictly above 100%.
  const tier = progress > 1 ? 2 : progress >= 0.7 ? 1 : 0;
  const glass = /скло|плівк|glass|tempered|anti peep/i.test(sale.name);
  const appleOriginal = /^\s*apple\b/i.test(sale.name) && !/\(hc\)|\bhc\b|high\s*copy|replica|реплік|копі/i.test(sale.name);
  if (glass) return [0.08, 0.09, 0.1][tier];
  if (appleOriginal) return [0.02, 0.03, 0.04][tier];
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

function serviceRate(personalPlanMet: boolean, storePlanMet: boolean, conversion: number) {
  if (storePlanMet && conversion >= 0.6) return 0.35;
  if (storePlanMet) return 0.3;
  if (personalPlanMet) return 0.25;
  return 0.2;
}

/** The rate grid is the legacy iPeople Plus motivation logic. */
export function calculatePayroll(
  employee: string,
  rows: ImportedSale[],
  targets: PayrollTargets,
  settings: PayrollSettings,
): PayrollResult {
  const owned = rows.filter((sale) => sale.employee === employee);
  const services = owned.filter((sale) => sale.category === "Услуги");
  const accessories = owned.filter((sale) => sale.category === "Аксессуары");
  const tech = owned.filter((sale) => sale.category === "Техника");
  const servicesRevenue = services.reduce((sum, sale) => sum + sale.revenue, 0);
  const accessoriesRevenue = accessories.reduce((sum, sale) => sum + sale.revenue, 0);
  const serviceProgress = targets.services > 0 ? servicesRevenue / targets.services : 0;
  const accessoriesProgress = targets.accessories > 0 ? accessoriesRevenue / targets.accessories : 0;
  const serviceConversion = tech.length > 0 ? services.length / tech.length : 0;
  const storeServicePlanMet = targets.storeServices > 0 && targets.storeServicesRevenue >= targets.storeServices;
  const appliedServiceRate = serviceRate(serviceProgress >= 1, storeServicePlanMet, serviceConversion);
  const techPay = tech.reduce((sum, sale) => sum + techUnitRate(sale.name), 0);
  const accessoriesPay = accessories.reduce((sum, sale) => sum + Math.round(sale.revenue * accessoryRate(sale, accessoriesProgress)), 0);
  const servicesPay = Math.round(servicesRevenue * appliedServiceRate);
  const focusPay = Math.max(0, settings.focusEarnings);
  // Repair revenue remains analytics-only. The actual repair earning is entered
  // manually because the sales feed does not contain the employee's repair profit.
  const repairsPay = Math.max(0, settings.repairEarnings);
  const basePay = Math.max(0, settings.dailyRate) * Math.max(0, settings.workDays);
  return {
    employee,
    servicesRevenue,
    accessoriesRevenue,
    techUnits: tech.length,
    serviceUnits: services.length,
    serviceConversion,
    serviceRate: appliedServiceRate,
    storeServicePlanMet,
    serviceProgress,
    accessoriesProgress,
    basePay,
    techPay,
    accessoriesPay,
    servicesPay,
    focusPay,
    repairsPay,
    total: basePay + techPay + accessoriesPay + servicesPay + focusPay + repairsPay,
    attributedRows: owned.length,
  };
}
