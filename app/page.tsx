"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  History,
  Link2,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  Search,
  Sparkles,
  UsersRound,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { importGoogleSheet, requestSheetsAccess, type ImportedSale } from "@/lib/google-sheets";
import { emptyEmployeeRules, type EmployeeRuleSet } from "@/lib/sales-import";
import { calculatePayroll, type PayrollSettings } from "@/lib/payroll";
import { defaultRepublicPlans, importRepublicPlans, type RepublicPlans } from "@/lib/republic-plans";
import salesData from "./sales-data.json";

type Category = "Техника" | "Аксессуары" | "Услуги";
type CategoryFilter = "Все" | Category;
type SortKey = "revenue" | "quantity";

type Sale = ImportedSale;

type ProductSummary = {
  name: string;
  category: Category;
  quantity: number;
  revenue: number;
};

type ImportHistoryEntry = {
  id: string;
  sheetUrl: string;
  sourceTitle: string;
  importedAt: string;
  records: Sale[];
};

type SavedDashboardState = {
  sheetUrl: string;
  sourceTitle: string;
  importedAt: string;
  records: Sale[];
  history: ImportHistoryEntry[];
  dateFrom: string;
  dateTo: string;
  republicPlans?: RepublicPlans;
  payrollSettings?: Record<string, PayrollSettings & { servicesTarget: number; accessoriesTarget: number }>;
  employeeRules?: EmployeeRuleSet;
};

const snapshotRecords = salesData as Sale[];
const categories: CategoryFilter[] = ["Все", "Техника", "Аксессуары", "Услуги"];
// OAuth client IDs identify the browser application and are intentionally public.
// Keep the environment variable as the primary setting, with the configured
// production client as a fallback so the import UI remains available after a
// static client bundle is published.
const googleClientId =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "1018608747117-90sj8o6p0uv62iigupdt2bqo2bp2l335.apps.googleusercontent.com";
const storageKey = "republic-sales-dashboard-v1";
const snapshotBounds = dateBounds(snapshotRecords);

const categoryColors: Record<Category, string> = {
  Техника: "#ff8a52",
  Аксессуары: "#16b8a6",
  Услуги: "#3b82f6",
};

const currency = new Intl.NumberFormat("uk-UA", {
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("uk-UA", {
  notation: "compact",
  style: "currency",
  currency: "UAH",
  maximumFractionDigits: 1,
});

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function dateBounds(data: Sale[]) {
  const dates = data.map((sale) => sale.date).filter(Boolean).sort();
  return { first: dates[0] ?? "", last: dates.at(-1) ?? "" };
}

function formatPeriod(firstDate: string, lastDate: string) {
  if (!firstDate || !lastDate) return "Нет данных";
  const first = new Date(`${firstDate}T00:00:00`);
  const last = new Date(`${lastDate}T00:00:00`);
  const fullDate = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (firstDate === lastDate) return fullDate.format(last).replace(" г.", "");
  if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
    const dateParts = fullDate.formatToParts(last);
    const month = dateParts.find((part) => part.type === "month")?.value ?? "";
    const year = dateParts.find((part) => part.type === "year")?.value ?? last.getFullYear().toString();
    return `${first.getDate()}–${last.getDate()} ${month} ${year}`;
  }
  return `${fullDate.format(first).replace(" г.", "")} — ${fullDate.format(last).replace(" г.", "")}`;
}

function aggregateProducts(data: Sale[]) {
  const products = new Map<string, ProductSummary>();
  data.forEach((sale) => {
    const key = `${sale.category}:${sale.name}`;
    const product = products.get(key) ?? {
      name: sale.name,
      category: sale.category as Category,
      quantity: 0,
      revenue: 0,
    };
    product.quantity += 1;
    product.revenue += sale.revenue;
    products.set(key, product);
  });
  return [...products.values()];
}

type EmployeePayrollSettings = PayrollSettings & { servicesTarget: number; accessoriesTarget: number };

function createPayrollSettings(plans: RepublicPlans, current: Record<string, EmployeePayrollSettings> = {}) {
  return Object.fromEntries(plans.employees.map((employee) => {
    const previous = current[employee.name];
    return [employee.name, {
      dailyRate: previous?.dailyRate ?? 500,
      workDays: previous?.workDays ?? 0,
      servicesTarget: previous?.servicesTarget ?? Math.round(plans.servicesTarget * employee.servicesShare),
      accessoriesTarget: previous?.accessoriesTarget ?? Math.round(plans.accessoriesTarget * employee.accessoriesShare),
    }];
  }));
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "navy",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof CircleDollarSign;
  tone?: "navy" | "mint" | "orange" | "white";
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span>{label}</span>
        <Icon aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className={`category-badge category-badge--${category.toLowerCase()}`}>
      {category}
    </span>
  );
}

function Dashboard() {
  const [records, setRecords] = useState<Sale[]>(snapshotRecords);
  const [category, setCategory] = useState<CategoryFilter>("Все");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sourceTitle, setSourceTitle] = useState("Google Sheets");
  const [importedAt, setImportedAt] = useState("");
  const [history, setHistory] = useState<ImportHistoryEntry[]>([]);
  const [republicPlans, setRepublicPlans] = useState<RepublicPlans>(defaultRepublicPlans);
  const [payrollSettings, setPayrollSettings] = useState<Record<string, EmployeePayrollSettings>>(
    () => createPayrollSettings(defaultRepublicPlans),
  );
  const [employeeRules, setEmployeeRules] = useState<EmployeeRuleSet>(emptyEmployeeRules);
  const [plansStatus, setPlansStatus] = useState<{ state: "idle" | "loading" | "success" | "error"; message: string }>({ state: "idle", message: "" });
  const [dateFrom, setDateFrom] = useState(snapshotBounds.first);
  const [dateTo, setDateTo] = useState(snapshotBounds.last);
  const [storageReady, setStorageReady] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [importStatus, setImportStatus] = useState<{
    state: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });

  const availableDates = useMemo(() => dateBounds(records), [records]);
  const reportingPeriod = useMemo(() => formatPeriod(dateFrom, dateTo), [dateFrom, dateTo]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SavedDashboardState>;
        if (Array.isArray(saved.records) && saved.records.length) {
          const bounds = dateBounds(saved.records as Sale[]);
          setRecords(saved.records as Sale[]);
          setSheetUrl(saved.sheetUrl ?? "");
          setSourceTitle(saved.sourceTitle === "Снимок отчёта" ? "Google Sheets" : saved.sourceTitle ?? "Google Sheets");
          setImportedAt(saved.importedAt ?? "");
          setHistory(Array.isArray(saved.history) ? saved.history.slice(0, 8) : []);
          setDateFrom(saved.dateFrom && saved.dateFrom >= bounds.first ? saved.dateFrom : bounds.first);
          setDateTo(saved.dateTo && saved.dateTo <= bounds.last ? saved.dateTo : bounds.last);
          if (saved.republicPlans?.employees?.length) {
            setRepublicPlans(saved.republicPlans);
            setPayrollSettings(createPayrollSettings(saved.republicPlans, saved.payrollSettings));
          } else if (saved.payrollSettings) {
            setPayrollSettings(createPayrollSettings(defaultRepublicPlans, saved.payrollSettings));
          }
          if (saved.employeeRules) setEmployeeRules(saved.employeeRules);
        }
      }
    } catch {
      setImportStatus({ state: "error", message: "Не удалось восстановить сохранённую историю этого браузера." });
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const saved: SavedDashboardState = {
      sheetUrl,
      sourceTitle,
      importedAt,
      records,
      history,
      dateFrom,
      dateTo,
      republicPlans,
      payrollSettings,
      employeeRules,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      setImportStatus({ state: "error", message: "Браузер не смог сохранить историю отчётов." });
    }
  }, [dateFrom, dateTo, employeeRules, history, importedAt, payrollSettings, records, republicPlans, sheetUrl, sourceTitle, storageReady]);

  async function handleSheetImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportStatus({ state: "loading", message: "Читаю отчёт…" });

    try {
      if (!googleClientId) {
        throw new Error("Для закрытой таблицы нужно один раз добавить Google OAuth Client ID в файл .env.local.");
      }
      const token = accessToken || (await requestSheetsAccess(googleClientId));
      if (!accessToken) setAccessToken(token);
      const result = await importGoogleSheet(sheetUrl, token, employeeRules);
      const bounds = dateBounds(result.records);
      const loadedAt = new Date().toISOString();
      const entry: ImportHistoryEntry = {
        id: loadedAt,
        sheetUrl,
        sourceTitle: result.title,
        importedAt: loadedAt,
        records: result.records,
      };
      setRecords(result.records);
      setSourceTitle(result.title);
      setImportedAt(loadedAt);
      setHistory((current) => [entry, ...current].slice(0, 8));
      setDateFrom(bounds.first);
      setDateTo(bounds.last);
      setCategory("Все");
      setQuery("");
      try {
        const plans = await importRepublicPlans(token);
        setRepublicPlans(plans);
        setPayrollSettings((current) => createPayrollSettings(plans, current));
        setPlansStatus({ state: "success", message: "Планы «Республіка» обновлены из Google Sheets." });
      } catch {
        setPlansStatus({ state: "error", message: "Продажи загружены, но планы «Республіка» пока не обновились." });
      }
      setImportStatus({
        state: "success",
        message: result.requiresReview
          ? `Готово: рассчитано ${result.records.length} строк. ${result.requiresReview} строк(и) ждут проверки сотрудника — они не будут начислены автоматически.`
          : `Готово: рассчитано ${result.records.length} строк. Исходная таблица не изменялась.`,
      });
    } catch (error) {
      setImportStatus({
        state: "error",
        message: error instanceof Error ? error.message : "Не удалось прочитать отчёт.",
      });
    }
  }

  async function syncRepublicPlans() {
    setPlansStatus({ state: "loading", message: "Обновляю планы «Республіка»…" });
    try {
      const token = accessToken || (await requestSheetsAccess(googleClientId));
      if (!accessToken) setAccessToken(token);
      const plans = await importRepublicPlans(token);
      setRepublicPlans(plans);
      setPayrollSettings((current) => createPayrollSettings(plans, current));
      setPlansStatus({ state: "success", message: "Планы «Республіка» обновлены из исходной таблицы." });
    } catch (error) {
      setPlansStatus({ state: "error", message: error instanceof Error ? error.message : "Не удалось обновить планы." });
    }
  }

  function updatePayrollSetting(employee: string, field: keyof EmployeePayrollSettings, value: number) {
    setPayrollSettings((current) => ({
      ...current,
      [employee]: { ...current[employee], [field]: Math.max(0, Number.isFinite(value) ? value : 0) },
    }));
  }

  function assignColor(color: string, employee: string) {
    setEmployeeRules((current) => {
      const colorOwners = { ...current.colorOwners };
      if (employee) colorOwners[color] = employee;
      else delete colorOwners[color];
      return { ...current, colorOwners };
    });
  }

  function restoreHistory(entryId: string) {
    const entry = history.find((item) => item.id === entryId);
    if (!entry) return;
    const bounds = dateBounds(entry.records);
    setRecords(entry.records);
    setSheetUrl(entry.sheetUrl);
    setSourceTitle(entry.sourceTitle);
    setImportedAt(entry.importedAt);
    setDateFrom(bounds.first);
    setDateTo(bounds.last);
    setCategory("Все");
    setQuery("");
    setImportStatus({ state: "success", message: "Сохранённая загрузка восстановлена." });
  }

  const periodRecords = useMemo(
    () => records.filter((sale) => (!dateFrom || sale.date >= dateFrom) && (!dateTo || sale.date <= dateTo)),
    [dateFrom, dateTo, records],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return periodRecords.filter((sale) => {
      const categoryMatches = category === "Все" ? sale.category !== "Ремонты" : sale.category === category;
      const queryMatches = !normalizedQuery || sale.name.toLocaleLowerCase("ru").includes(normalizedQuery);
      return categoryMatches && queryMatches;
    });
  }, [category, periodRecords, query]);

  const totals = useMemo(() => {
    const allRevenue = periodRecords.reduce((sum, sale) => sum + sale.revenue, 0);
    const revenue = category === "Все" && !query.trim()
      ? allRevenue
      : filtered.reduce((sum, sale) => sum + sale.revenue, 0);
    return {
      revenue,
      quantity: filtered.length,
      share: allRevenue ? revenue / allRevenue : 0,
    };
  }, [category, filtered, periodRecords, query]);

  const baseCounts = useMemo(() => {
    const technique = periodRecords.filter((sale) => sale.category === "Техника").length;
    const accessories = periodRecords.filter((sale) => sale.category === "Аксессуары").length;
    const services = periodRecords.filter((sale) => sale.category === "Услуги").length;
    const repairs = periodRecords.filter((sale) => sale.category === "Ремонты").length;
    return {
      technique,
      accessories,
      services,
      repairs,
      categorized: technique + accessories + services,
      servicePenetration: technique ? services / technique : 0,
      accessoriesPerDevice: technique ? accessories / technique : 0,
    };
  }, [periodRecords]);

  const payrollResults = useMemo(() => republicPlans.employees.map((employee) => {
    const settings = payrollSettings[employee.name] ?? {
      dailyRate: 500,
      workDays: 0,
      servicesTarget: Math.round(republicPlans.servicesTarget * employee.servicesShare),
      accessoriesTarget: Math.round(republicPlans.accessoriesTarget * employee.accessoriesShare),
    };
    return calculatePayroll(employee.name, periodRecords, {
      services: settings.servicesTarget,
      accessories: settings.accessoriesTarget,
    }, settings);
  }), [payrollSettings, periodRecords, republicPlans]);

  const unassignedColors = useMemo(() => [...new Set(
    periodRecords
      .filter((sale) => !sale.employee && sale.sourceColor && sale.sourceColor !== "none")
      .map((sale) => sale.sourceColor),
  )].sort(), [periodRecords]);

  const dailyData = useMemo(() => {
    const days = new Map<string, number>();
    const chartRecords = category === "Все" && !query.trim() ? periodRecords : filtered;
    periodRecords.forEach((sale) => days.set(sale.date, 0));
    chartRecords.forEach((sale) => days.set(sale.date, (days.get(sale.date) ?? 0) + sale.revenue));
    return [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({
        day: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
          new Date(`${date}T00:00:00`),
        ),
        revenue,
      }));
  }, [category, filtered, periodRecords, query]);

  const categoryData = useMemo(
    () =>
      (["Техника", "Аксессуары", "Услуги"] as Category[]).map((item) => ({
        name: item,
        value: periodRecords.filter((sale) => sale.category === item).length,
        share: baseCounts.categorized
          ? periodRecords.filter((sale) => sale.category === item).length / baseCounts.categorized
          : 0,
        fill: categoryColors[item],
      })),
    [baseCounts.categorized, periodRecords],
  );

  const rankedProducts = useMemo(() => {
    const products = aggregateProducts(filtered);
    return products.sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 9);
  }, [filtered, sortKey]);

  const serviceRanking = useMemo(() => {
    return aggregateProducts(periodRecords.filter((sale) => sale.category === "Услуги"))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4);
  }, [periodRecords]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <BarChart3 />
          </span>
          <div>
            <p>Продажи</p>
            <h1>iPeople Report</h1>
          </div>
        </div>

        <div className="topbar-importer">
          <form className="topbar-importer__form" onSubmit={handleSheetImport}>
            <label>
              <span className="sr-only">Ссылка на Google-таблицу</span>
              <Link2 aria-hidden="true" />
              <Input
                type="url"
                required
                value={sheetUrl}
                onChange={(event) => setSheetUrl(event.target.value)}
                placeholder="Вставьте ссылку на Google-отчёт"
              />
            </label>
            <Button type="submit" disabled={importStatus.state === "loading"}>
              {importStatus.state === "loading" ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <BarChart3 aria-hidden="true" />
              )}
              Рассчитать
            </Button>
          </form>
          <div className="topbar-importer__meta">
            <span title={sourceTitle}>{sourceTitle} · только чтение</span>
            {history.length > 0 && (
              <label className="history-picker">
                <History aria-hidden="true" />
                <span className="sr-only">История загрузок</span>
                <select value={importedAt} onChange={(event) => restoreHistory(event.target.value)}>
                  {history.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {dateTime.format(new Date(entry.importedAt))} · {entry.sourceTitle}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {importStatus.message && (
            <p className={`import-status import-status--${importStatus.state}`} role="status">
              {importStatus.state === "success" && <CheckCircle2 aria-hidden="true" />}
              {importStatus.message}
            </p>
          )}
        </div>
      </header>

      <section className="dashboard">
        <div className="dashboard-heading">
          <div className="period-picker" aria-label="Выбор периода отчёта">
            <div className="period-picker__title">
              <CalendarDays aria-hidden="true" />
              <span>Период</span>
              <strong>{reportingPeriod}</strong>
            </div>
            <label>
              <span>С</span>
              <Input
                type="date"
                min={availableDates.first}
                max={availableDates.last}
                value={dateFrom}
                onChange={(event) => {
                  const next = event.target.value;
                  setDateFrom(next);
                  if (dateTo && next > dateTo) setDateTo(next);
                }}
              />
            </label>
            <label>
              <span>По</span>
              <Input
                type="date"
                min={availableDates.first}
                max={availableDates.last}
                value={dateTo}
                onChange={(event) => {
                  const next = event.target.value;
                  setDateTo(next);
                  if (dateFrom && next < dateFrom) setDateFrom(next);
                }}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDateFrom(availableDates.first);
                setDateTo(availableDates.last);
              }}
            >
              Весь период
            </Button>
          </div>
        </div>

        <div className="metric-grid">
          <MetricCard
            label={category === "Все" ? "Выручка" : `Выручка · ${category}`}
            value={compactCurrency.format(totals.revenue)}
            detail={`${Math.round(totals.share * 100)}% от общей выручки`}
            icon={CircleDollarSign}
            tone="navy"
          />
          <MetricCard
            label="Продано позиций"
            value={String(totals.quantity)}
            detail={
              category === "Все"
                ? `${baseCounts.repairs} ремонта учтены только в выручке`
                : `категория «${category}»`
            }
            icon={PackageCheck}
            tone="white"
          />
          <MetricCard
            label="Проникновение услуг"
            value={`${(baseCounts.servicePenetration * 100).toFixed(1)}%`}
            detail={`${baseCounts.services} услуг на ${baseCounts.technique} единиц техники`}
            icon={Wrench}
            tone="orange"
          />
          <MetricCard
            label="Аксессуаров на технику"
            value={baseCounts.accessoriesPerDevice.toFixed(1)}
            detail={`${baseCounts.accessories} аксессуаров на ${baseCounts.technique} единиц техники`}
            icon={Boxes}
            tone="mint"
          />
        </div>

        <section className="payroll-panel" aria-labelledby="payroll-title">
          <div className="payroll-panel__heading">
            <div>
              <p className="panel-kicker">Республіка · мотивация</p>
              <h2 id="payroll-title">Планы и ЗП сотрудников</h2>
              <p>Ставки перенесены из старого iPeople Plus. Продажи начисляются только после привязки к сотруднику.</p>
            </div>
            <Button type="button" variant="outline" onClick={syncRepublicPlans} disabled={plansStatus.state === "loading"}>
              <RefreshCw className={plansStatus.state === "loading" ? "animate-spin" : ""} aria-hidden="true" />
              Обновить планы
            </Button>
          </div>

          <div className="store-plan-grid">
            <label>
              <span>План услуг · магазин</span>
              <Input type="number" min="0" value={republicPlans.servicesTarget} onChange={(event) => setRepublicPlans((current) => ({ ...current, servicesTarget: Number(event.target.value) || 0 }))} />
              <small>₴ · источник: лист «Республіка»</small>
            </label>
            <label>
              <span>План аксессуаров · магазин</span>
              <Input type="number" min="0" value={republicPlans.accessoriesTarget} onChange={(event) => setRepublicPlans((current) => ({ ...current, accessoriesTarget: Number(event.target.value) || 0 }))} />
              <small>₴ · можно изменить вручную</small>
            </label>
            <div className="team-pay-total">
              <BadgeDollarSign aria-hidden="true" />
              <span>ЗП команды по текущим данным</span>
              <strong>{currency.format(payrollResults.reduce((sum, item) => sum + item.total, 0))}</strong>
            </div>
          </div>
          {plansStatus.message && <p className={`plans-status plans-status--${plansStatus.state}`} role="status">{plansStatus.message}</p>}

          <div className="payroll-cards">
            {republicPlans.employees.map((employee, index) => {
              const settings = payrollSettings[employee.name] ?? createPayrollSettings(republicPlans)[employee.name];
              const payroll = payrollResults[index];
              return (
                <article className="payroll-card" key={employee.name}>
                  <div className="payroll-card__head">
                    <div><UsersRound aria-hidden="true" /><h3>{employee.name}</h3></div>
                    <strong>{currency.format(payroll.total)}</strong>
                  </div>
                  <p className="payroll-card__rows">Привязано: {payroll.attributedRows} строк · техника: {payroll.techUnits} шт.</p>
                  <div className="employee-plan-inputs">
                    <label>План услуг<Input type="number" min="0" value={settings.servicesTarget} onChange={(event) => updatePayrollSetting(employee.name, "servicesTarget", Number(event.target.value))} /></label>
                    <label>План аксес.<Input type="number" min="0" value={settings.accessoriesTarget} onChange={(event) => updatePayrollSetting(employee.name, "accessoriesTarget", Number(event.target.value))} /></label>
                    <label>Ставка/день<Input type="number" min="0" value={settings.dailyRate} onChange={(event) => updatePayrollSetting(employee.name, "dailyRate", Number(event.target.value))} /></label>
                    <label>Смены<Input type="number" min="0" value={settings.workDays} onChange={(event) => updatePayrollSetting(employee.name, "workDays", Number(event.target.value))} /></label>
                  </div>
                  <div className="payroll-breakdown">
                    <span>Ставка <b>{currency.format(payroll.basePay)}</b></span>
                    <span>Техника <b>{currency.format(payroll.techPay)}</b></span>
                    <span>Аксессуары {Math.round(payroll.accessoriesProgress * 100)}% <b>{currency.format(payroll.accessoriesPay)}</b></span>
                    <span>Услуги {Math.round(payroll.serviceProgress * 100)}% <b>{currency.format(payroll.servicesPay)}</b></span>
                  </div>
                </article>
              );
            })}
          </div>

          {unassignedColors.length > 0 && (
            <div className="color-mapping">
              <div><p className="panel-kicker">Привязка цветов</p><h3>Кому принадлежат продажи?</h3><p>Назначьте цвет из таблицы сотруднику один раз. После следующего «Рассчитать» строки будут учтены в его ЗП.</p></div>
              <div className="color-mapping__list">
                {unassignedColors.map((color) => (
                  <label key={color}>
                    <i style={{ backgroundColor: `#${color}` }} aria-hidden="true" />
                    <span>#{color}</span>
                    <select value={employeeRules.colorOwners[color] ?? ""} onChange={(event) => assignColor(color, event.target.value)}>
                      <option value="">Не назначен</option>
                      {republicPlans.employees.map((employee) => <option key={employee.name} value={employee.name}>{employee.name}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="filter-row" aria-label="Фильтры отчёта">
          <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
            <TabsList className="category-tabs">
              {categories.map((item) => (
                <TabsTrigger key={item} value={item} className="category-tab">
                  {item}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <label className="search-box">
            <Search aria-hidden="true" />
            <span className="sr-only">Поиск по названию</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти товар или услугу"
            />
          </label>
        </section>

        <div className="analytics-grid">
          <article className="panel revenue-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Динамика</p>
                <h3>Выручка по дням</h3>
              </div>
              <span>{category}</span>
            </div>
            <ChartContainer
              className="revenue-chart"
              config={{ revenue: { label: "Выручка", color: "#16b8a6" } }}
            >
              <BarChart data={dailyData} margin={{ top: 12, right: 6, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 5" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.round(value / 1000)}к`}
                />
                <ChartTooltip
                  cursor={{ fill: "rgba(16, 36, 58, 0.04)" }}
                  content={
                    <ChartTooltipContent
                      formatter={(value) => (
                        <div className="flex min-w-36 items-center justify-between gap-4">
                          <span className="text-muted-foreground">Выручка</span>
                          <strong>{currency.format(Number(value))}</strong>
                        </div>
                      )}
                    />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[8, 8, 2, 2]} />
              </BarChart>
            </ChartContainer>
          </article>

          <article className="panel mix-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Структура</p>
                <h3>Доля категорий</h3>
              </div>
              <span>{baseCounts.categorized} позиций без ремонтов</span>
            </div>
            <div className="mix-content">
              <ChartContainer
                className="mix-chart"
                config={{ value: { label: "Позиций", color: "#16b8a6" } }}
              >
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
              <div className="mix-legend">
                {categoryData.map((item) => (
                  <div key={item.name}>
                    <span style={{ backgroundColor: item.fill }} />
                    <p>{item.name}</p>
                    <strong>{(item.share * 100).toFixed(1)}%</strong>
                    <small>{item.value} шт.</small>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>

        <div className="bottom-grid">
          <article className="panel ranking-panel">
            <div className="panel-heading panel-heading--table">
              <div>
                <p className="panel-kicker">Рейтинг</p>
                <h3>Сильные и слабые позиции</h3>
              </div>
              <div className="sort-actions" aria-label="Сортировка рейтинга">
                <Button
                  size="sm"
                  variant={sortKey === "revenue" ? "default" : "ghost"}
                  onClick={() => setSortKey("revenue")}
                >
                  По выручке
                </Button>
                <Button
                  size="sm"
                  variant={sortKey === "quantity" ? "default" : "ghost"}
                  onClick={() => setSortKey("quantity")}
                >
                  По количеству
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">№</TableHead>
                  <TableHead>Позиция</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="text-right">Шт.</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankedProducts.map((product, index) => (
                  <TableRow key={`${product.category}:${product.name}`}>
                    <TableCell className="rank-number">{String(index + 1).padStart(2, "0")}</TableCell>
                    <TableCell className="product-name" title={product.name}>
                      {product.name}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={product.category} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {product.quantity}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {currency.format(product.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rankedProducts.length && (
              <div className="empty-state">По этому запросу ничего не найдено.</div>
            )}
          </article>

          <article className="panel penetration-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Услуги</p>
                <h3>Проникновение по пакетам</h3>
              </div>
              <Sparkles aria-hidden="true" />
            </div>
            <div className="penetration-total">
              <strong>{(baseCounts.servicePenetration * 100).toFixed(1)}%</strong>
              <span>услуг на единицу техники</span>
            </div>
            <div className="penetration-list">
              {serviceRanking.map((service) => {
                const penetration = (service.quantity / baseCounts.technique) * 100;
                return (
                  <div key={service.name} className="penetration-item">
                    <div>
                      <p>{service.name}</p>
                      <strong>{penetration.toFixed(1)}%</strong>
                    </div>
                    <div className="penetration-track">
                      <span style={{ width: `${Math.min(penetration * 2.6, 100)}%` }} />
                    </div>
                    <small>{service.quantity} продаж</small>
                  </div>
                );
              })}
            </div>
          </article>
        </div>

        <footer className="dashboard-footer">
          <span>Власність <strong>@Afkk1ng</strong></span>
        </footer>
      </section>
    </main>
  );
}

function LoginGate({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "Не удалось выполнить вход.");
      }
      setPassword("");
      onAuthenticated();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось выполнить вход.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <span className="brand-mark" aria-hidden="true"><BarChart3 /></span>
        <p className="login-eyebrow">iPeople Plus</p>
        <h1>Вход в аналитику</h1>
        <p>Продажи, услуги и будущий расчёт зарплаты доступны только после входа.</p>
        <label>
          Логин
          <Input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>
        <label>
          Пароль
          <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {status && <p className="login-error" role="alert">{status}</p>}
        <Button type="submit" disabled={submitting}>{submitting ? "Проверяю…" : "Войти"}</Button>
      </form>
    </main>
  );
}

export default function Home() {
  const [state, setState] = useState<"checking" | "guest" | "ready">("checking");

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : { authenticated: false })
      .then((body: { authenticated?: boolean }) => setState(body.authenticated ? "ready" : "guest"))
      .catch(() => setState("guest"));
  }, []);

  if (state === "checking") return <main className="login-shell"><p className="login-check">Проверяем доступ…</p></main>;
  if (state === "guest") return <LoginGate onAuthenticated={() => setState("ready")} />;
  return <Dashboard />;
}
