export type RepublicEmployeePlan = {
  name: string;
  servicesShare: number;
  accessoriesShare: number;
};

export type RepublicPlans = {
  storeName: "Республіка";
  servicesTarget: number;
  accessoriesTarget: number;
  employees: RepublicEmployeePlan[];
  sourceTitle: string;
};

const PLAN_SHEET_URL = "https://docs.google.com/spreadsheets/d/1fahWzUl8fIekNtoLd9dPhun0ApiYxsLaGahRpffxumw/edit?gid=0#gid=0";

type ValueRange = { values?: Array<Array<string | number | boolean>> };

function numberFromCell(value: string | number | boolean | undefined) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", ".");
  return Number(normalized) || 0;
}

async function readRange(spreadsheetId: string, range: string, token: string) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("Не удалось прочитать планы «Республіка» из Google Sheets.");
  return response.json() as Promise<ValueRange>;
}

/** Reads only the Republic tab and never changes the source spreadsheet. */
export async function importRepublicPlans(accessToken: string): Promise<RepublicPlans> {
  const spreadsheetId = "1fahWzUl8fIekNtoLd9dPhun0ApiYxsLaGahRpffxumw";
  const result = await readRange(spreadsheetId, "Республіка!A1:C20", accessToken);
  const rows = result.values ?? [];
  const servicesTarget = numberFromCell(rows[0]?.[1]);
  const accessoriesTarget = numberFromCell(rows[9]?.[1]);
  const servicesRows = rows.slice(3, 7);
  const accessoriesRows = rows.slice(12, 16);
  const shares = new Map<string, { servicesShare: number; accessoriesShare: number }>();

  servicesRows.forEach((row) => {
    const name = String(row[0] ?? "").trim();
    if (name) shares.set(name, { servicesShare: numberFromCell(row[1]) / 100, accessoriesShare: 0 });
  });
  accessoriesRows.forEach((row) => {
    const name = String(row[0] ?? "").trim();
    if (!name) return;
    const current = shares.get(name) ?? { servicesShare: 0, accessoriesShare: 0 };
    shares.set(name, { ...current, accessoriesShare: numberFromCell(row[1]) / 100 });
  });

  if (!servicesTarget || !accessoriesTarget || !shares.size) {
    throw new Error("В листе «Республіка» не найдены планы услуг и аксессуаров в ожидаемом формате.");
  }

  return {
    storeName: "Республіка",
    servicesTarget,
    accessoriesTarget,
    employees: [...shares.entries()].map(([name, share]) => ({ name, ...share })),
    sourceTitle: PLAN_SHEET_URL,
  };
}

export const defaultRepublicPlans: RepublicPlans = {
  storeName: "Республіка",
  servicesTarget: 320000,
  accessoriesTarget: 550000,
  employees: [
    { name: "Д’яченко Олексій", servicesShare: 0.25, accessoriesShare: 0.25 },
    { name: "Гриценко Аліна", servicesShare: 0.25, accessoriesShare: 0.25 },
    { name: "Приходько Микола", servicesShare: 0.25, accessoriesShare: 0.25 },
    { name: "Недопас Оксана", servicesShare: 0.25, accessoriesShare: 0.25 },
  ],
  sourceTitle: PLAN_SHEET_URL,
};
