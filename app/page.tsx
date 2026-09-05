'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, ClipboardCheck, Clock3, Copy, Crown, Minus, Plus, ReceiptText, RotateCcw, Settings2, Sparkles, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

const team = ['Макс', 'Алина', 'Алексей', 'Коля', 'Ксюша', 'Ира', 'Арсен'];
const tech = [
  { id: 'new', label: 'Apple · нова', personal: 80, online: 40 },
  { id: 'open', label: 'Apple · open box', personal: 120, online: 60 },
  { id: 'used', label: 'Apple · вживана', personal: 160, online: 80 },
  { id: 'periphery', label: 'Периферія', personal: 50, online: 25 },
  { id: 'other', label: 'Техніка · інше', personal: 80, online: 40 },
];
const accessories = [
  { id: 'glass', label: 'Скло і плівки', rates: [8, 9, 10] },
  { id: 'small', label: 'До 1 000 грн', rates: [10, 12, 14] },
  { id: 'middle', label: '1 001–3 000 грн', rates: [3, 5, 7] },
  { id: 'large', label: 'Від 3 001 грн', rates: [2, 3, 4] },
  { id: 'original', label: 'Apple original', rates: [2, 3, 4] },
];
const bonuses = [
  { id: 'google', label: 'Відгук Google', short: 'G', value: 100 },
  { id: 'hotline', label: 'Hotline / Instagram', short: 'H', value: 300 },
  { id: 'hire', label: 'Рекомендація людини', short: '+', value: 4000 },
];
const servicePlans = [
  { value: 'basic', label: 'Базовий · 20%', rate: 20 },
  { value: 'plus', label: 'Понад план · 25%', rate: 25 },
  { value: 'pro', label: 'Понад план + · 30%', rate: 30 },
  { value: 'max', label: 'Понад план ++ · 35%', rate: 35 },
];
type Values = Record<string, number>;
type DailyReport = { id: string; employee: string; date: string; base: number; tech: number; accessories: number; services: number; serviceUnits: number; repairs: number; bonuses: number; total: number; units: number; turnover: number };
const money = (value: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }).format(value);
const emptyTech = () => Object.fromEntries(tech.flatMap(x => [[`${x.id}-personal`, 0], [`${x.id}-online`, 0]]));
const emptyAccessories = () => Object.fromEntries(accessories.map(x => [x.id, 0]));
const emptyBonuses = () => Object.fromEntries(bonuses.map(x => [x.id, 0]));

function Picker({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
  const selectedLabel = options.find(option => option.value === value)?.label ?? value;
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="h-11 w-full rounded-xl border-0 bg-[#edf0f5] px-4 text-sm font-semibold text-[#3c424c]"><span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span></SelectTrigger><SelectContent className="cyber-select-content">{options.map(x => <SelectItem className="cyber-select-item" key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent></Select>;
}

function Stepper({ value, onChange, compact = false }: { value: number; onChange: (value: number) => void; compact?: boolean }) {
  return <div className={`flex items-center justify-between rounded-xl bg-[#f1f3f7] ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}><button aria-label="Зменшити" onClick={() => onChange(Math.max(0, value - 1))} className="grid size-7 place-items-center rounded-lg text-[#68717f] hover:bg-white"><Minus className="size-4" /></button><span className="min-w-7 text-center text-base font-bold">{value}</span><button aria-label="Збільшити" onClick={() => onChange(value + 1)} className="grid size-7 place-items-center rounded-lg bg-white text-[#386ff0] shadow-sm hover:bg-[#e6edff]"><Plus className="size-4" /></button></div>;
}

function AmountField({ value, onChange, placeholder }: { value: number; onChange: (value: number) => void; placeholder: string }) {
  return <div className="relative"><Input inputMode="numeric" value={value || ''} onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder={placeholder} className="h-11 rounded-xl border-0 bg-[#edf0f5] pr-11 text-right text-base font-bold shadow-none placeholder:text-[#9ba2af] focus-visible:ring-2" /><span className="pointer-events-none absolute right-4 top-2.5 text-sm font-semibold text-[#8a92a0]">грн</span></div>;
}

export default function Home() {
  const [view, setView] = useState<'calculator' | 'leaders'>('calculator');
  const [employee, setEmployee] = useState('Макс');
  const [dayRate, setDayRate] = useState(500);
  const [days, setDays] = useState(0);
  const [plan, setPlan] = useState('under');
  const [servicePlan, setServicePlan] = useState('basic');
  const [techCount, setTechCount] = useState<Values>(emptyTech);
  const [accessorySums, setAccessorySums] = useState<Values>(emptyAccessories);
  const [serviceAmount, setServiceAmount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [repairProfit, setRepairProfit] = useState(0);
  const [bonusCount, setBonusCount] = useState<Values>(emptyBonuses);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [dayText, setDayText] = useState('Сьогодні');
  useEffect(() => { const cached = localStorage.getItem('motiva-reports'); if (cached) setReports(JSON.parse(cached)); setLoaded(true); }, []);
  useEffect(() => { if (loaded) localStorage.setItem('motiva-reports', JSON.stringify(reports)); }, [loaded, reports]);
  useEffect(() => { setDayText(new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())); }, []);
  useEffect(() => { setHydrated(true); }, []);
  const planIndex = plan === 'under' ? 0 : plan === 'target' ? 1 : 2;
  const serviceRate = servicePlans.find(item => item.value === servicePlan)?.rate ?? 20;
  const calculations = useMemo(() => {
    const base = dayRate * days;
    const techPay = tech.reduce((sum, item) => sum + techCount[`${item.id}-personal`] * item.personal + techCount[`${item.id}-online`] * item.online, 0);
    const accessoriesPay = accessories.reduce((sum, item) => sum + Math.round(accessorySums[item.id] * item.rates[planIndex] / 100), 0);
    const servicesPay = Math.round(serviceAmount * serviceRate / 100);
    const repairsPay = Math.round(repairProfit * 0.05);
    const bonusPay = bonuses.reduce((sum, item) => sum + bonusCount[item.id] * item.value, 0);
    const units = Object.values(techCount).reduce((sum, count) => sum + count, 0);
    const turnover = Object.values(accessorySums).reduce((sum, amount) => sum + amount, 0) + serviceAmount + repairProfit;
    return { base, techPay, accessoriesPay, servicesPay, repairsPay, bonusPay, units, turnover, total: base + techPay + accessoriesPay + servicesPay + repairsPay + bonusPay };
  }, [accessorySums, bonusCount, dayRate, days, planIndex, repairProfit, serviceAmount, serviceRate, techCount]);
  function changeCount(key: string, value: number, target: 'tech' | 'bonus') { if (target === 'tech') setTechCount(current => ({ ...current, [key]: value })); else setBonusCount(current => ({ ...current, [key]: value })); setSaved(false); }
  function resetShift() { setDayRate(500); setDays(0); setPlan('under'); setServicePlan('basic'); setTechCount(emptyTech()); setAccessorySums(emptyAccessories()); setServiceAmount(0); setServiceCount(0); setRepairProfit(0); setBonusCount(emptyBonuses()); setSaved(false); setSendMessage(''); }
  const reportText = useMemo(() => {
    const techRows = tech.flatMap(item => [
      techCount[`${item.id}-personal`] ? `• ${item.label}, особистий: ${techCount[`${item.id}-personal`]} шт. — ${money(techCount[`${item.id}-personal`] * item.personal)}` : '',
      techCount[`${item.id}-online`] ? `• ${item.label}, інтернет: ${techCount[`${item.id}-online`]} шт. — ${money(techCount[`${item.id}-online`] * item.online)}` : '',
    ]).filter(Boolean);
    const accessoryRows = accessories.map(item => accessorySums[item.id] ? `• ${item.label}: ${money(accessorySums[item.id])} → ${money(Math.round(accessorySums[item.id] * item.rates[planIndex] / 100))}` : '').filter(Boolean);
    return [`iPeople PULSE · звіт зміни`, `Дата: ${dayText}`, `Співробітник: ${employee}`, '', `Зміна: ${days} дн. — ${money(calculations.base)}`, `Гаджети: ${calculations.units} шт. — ${money(calculations.techPay)}`, ...techRows, `Послуги: ${serviceCount} шт. · ${money(serviceAmount)} → ${money(calculations.servicesPay)} (${serviceRate}%)`, `Аксесуари: ${money(Object.values(accessorySums).reduce((sum, value) => sum + value, 0))} → ${money(calculations.accessoriesPay)}`, ...accessoryRows, `Ремонти: ${money(repairProfit)} → ${money(calculations.repairsPay)} (5%)`, `Бонуси: ${money(calculations.bonusPay)}`, '', `В ЗП за зміну: ${money(calculations.total)}`].join('\n');
  }, [accessorySums, calculations, dayText, days, employee, planIndex, repairProfit, serviceAmount, serviceCount, serviceRate, techCount]);
  function saveReport() { const date = new Date().toISOString().slice(0, 10); const report: DailyReport = { id: crypto.randomUUID(), employee, date, base: calculations.base, tech: calculations.techPay, accessories: calculations.accessoriesPay, services: calculations.servicesPay, serviceUnits: serviceCount, repairs: calculations.repairsPay, bonuses: calculations.bonusPay, total: calculations.total, units: calculations.units, turnover: calculations.turnover }; setReports(current => [...current, report]); setSaved(true); }
  async function sendReport() { setSending(true); setSendMessage(''); try { const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee, date: new Date().toISOString().slice(0, 10), total: calculations.total, text: reportText }) }); if (!response.ok) throw new Error('send-failed'); const result = await response.json() as { telegramReady?: boolean }; saveReport(); setSendMessage(result.telegramReady ? 'Звіт збережено й надіслано в Telegram.' : 'Звіт збережено. Натисніть Start у боті, щоб увімкнути Telegram.'); } catch { setSendMessage('Не вдалося надіслати звіт. Спробуйте ще раз.'); } finally { setSending(false); } }
  async function copyReport() { await navigator.clipboard.writeText(reportText); setSaved(true); }
  const leaderboard = [...reports].sort((a, b) => b.total - a.total);
  if (!hydrated) return <main className="cyber-screen grid min-h-screen place-items-center p-6 text-center"><div><div className="cyber-logo mx-auto mb-4 grid size-12 place-items-center rounded-2xl text-xl font-extrabold">iP</div><p className="font-extrabold">Завантажуємо iPeople PULSE…</p></div></main>;
  return <main className="cyber-screen min-h-screen"><header className="cyber-header border-b backdrop-blur"><div className="mx-auto flex max-w-[1260px] items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="cyber-logo grid size-10 place-items-center rounded-xl text-xs font-black tracking-tighter">iP</div><div><p className="font-extrabold tracking-tight">iPeople <span className="cyber-pulse">PULSE</span></p><p className="text-xs text-[#7a8493]">Продажі · мотивація · команда</p></div></div><nav className="cyber-nav flex rounded-xl p-1"><button onClick={() => setView('calculator')} className={`rounded-lg px-3 py-2 text-sm font-bold ${view === 'calculator' ? 'bg-white text-[#246bfd] shadow-sm' : 'text-[#7a8493]'}`}>Калькулятор</button><button onClick={() => setView('leaders')} className={`cyber-leaders-tab rounded-lg px-3 py-2 text-sm font-bold ${view === 'leaders' ? 'bg-white text-[#246bfd] shadow-sm' : 'text-[#7a8493]'}`}><Crown className="size-4" /> Лідери</button></nav></div></header>
  <div className="mx-auto max-w-[1260px] px-5 py-8"><div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 text-sm font-bold text-[#526fff]">{dayText}</p><h1 className="text-3xl font-extrabold tracking-tight">{view === 'calculator' ? 'Моя мотивація' : 'Таблиця лідерів'}</h1></div>{view === 'calculator' && <button type="button" onClick={resetShift} className="cyber-reset" title="Скинути всі дані зміни" aria-label="Скинути всі дані зміни"><span className="reset-clock"><Clock3 /></span><RotateCcw className="reset-arrow" /></button>}</div>
  {view === 'calculator' ? <div className="space-y-6"><section><h2 className="mb-3 text-xl font-extrabold">Основа</h2><div className="grid gap-3 rounded-3xl bg-[#e9ebf1] p-4 sm:grid-cols-2 lg:grid-cols-5"><Field label="Співробітник"><Picker value={employee} onChange={setEmployee} label="Співробітник" options={team.map(x => ({ value: x, label: x }))} /></Field><Field label="Ставка за день"><AmountField value={dayRate} onChange={setDayRate} placeholder="0" /></Field><Field label="Відпрацьовані дні"><Stepper value={days} onChange={setDays} /></Field><Field label="План аксесуарів"><Picker value={plan} onChange={setPlan} label="План аксесуарів" options={[{ value: 'under', label: 'Базовий план' }, { value: 'target', label: '70–100% плану' }, { value: 'over', label: 'Понад 100% плану' }]} /></Field><Field label="План послуг"><Picker value={servicePlan} onChange={setServicePlan} label="План послуг" options={servicePlans} /></Field></div></section>
    <section><div className="mb-3 flex items-center gap-2"><h2 className="text-xl font-extrabold">Техніка</h2><span className="rounded-full bg-[#eaf0ff] px-2.5 py-1 text-xs font-bold text-[#3c5dcb]">кількість продажів</span></div><div className="grid gap-3 rounded-3xl bg-[#e9ebf1] p-4 sm:grid-cols-2 lg:grid-cols-5">{tech.map(item => <div key={item.id} className="rounded-2xl bg-white p-4 shadow-[0_3px_9px_rgb(23_30_45/0.04)]"><p className="min-h-10 text-sm font-extrabold">{item.label}</p><div className="mt-3 space-y-2"><div><p className="mb-1.5 text-xs font-bold text-[#7c8696]">Особистий · {item.personal} грн</p><Stepper compact value={techCount[`${item.id}-personal`]} onChange={value => changeCount(`${item.id}-personal`, value, 'tech')} /></div><div><p className="mb-1.5 text-xs font-bold text-[#7c8696]">Інтернет · {item.online} грн</p><Stepper compact value={techCount[`${item.id}-online`]} onChange={value => changeCount(`${item.id}-online`, value, 'tech')} /></div></div></div>)}</div></section>
    <section><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h2 className="text-xl font-extrabold">Аксесуари</h2><span className="rounded-full bg-[#eaf0ff] px-2.5 py-1 text-xs font-bold text-[#3c5dcb]">введіть оборот за категоріями</span></div><p className="text-sm font-bold text-[#526fff]">Поточна ставка: {plan === 'under' ? 'базовий план' : plan === 'target' ? '70–100%' : 'понад 100%'}</p></div><div className="grid gap-3 rounded-3xl bg-[#e9ebf1] p-4 sm:grid-cols-2 lg:grid-cols-5">{accessories.map(item => <div key={item.id} className="rounded-2xl bg-white p-4"><p className="min-h-10 text-sm font-extrabold">{item.label}</p><p className="mb-3 text-xs font-bold text-[#6976a0]">{item.rates[planIndex]}% у зарплату</p><AmountField value={accessorySums[item.id]} onChange={value => { setAccessorySums(current => ({ ...current, [item.id]: value })); setSaved(false); }} placeholder="0" /></div>)}</div></section>
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="rounded-3xl bg-[#e9ebf1] p-4"><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-white p-5"><h2 className="text-xl font-extrabold">Бонуси</h2><div className="mt-4 space-y-3">{bonuses.map(item => <div key={item.id} className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">{item.label}</p><p className="text-xs text-[#798394]">{money(item.value)} за 1</p></div><Stepper compact value={bonusCount[item.id]} onChange={value => changeCount(item.id, value, 'bonus')} /></div>)}</div></div><ServiceCard amount={serviceAmount} count={serviceCount} rate={serviceRate} onChange={value => { setServiceAmount(value); setSaved(false); }} onCountChange={value => { setServiceCount(value); setSaved(false); }} /><div className="rounded-2xl bg-[#183458] p-5 text-white"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white/12"><Wrench className="size-5 text-[#8fb8ff]" /></div><div><h2 className="font-extrabold">Ремонти вручну</h2><p className="text-sm text-[#b9cae4]">Впишіть чистий прибуток з ремонтів</p></div></div><div className="mt-5"><label className="text-sm font-bold text-[#cfddf3]">Чистий прибуток з ремонтів</label><div className="relative mt-2"><Input inputMode="numeric" value={repairProfit || ''} onChange={e => { setRepairProfit(Number(e.target.value.replace(/\D/g, '')) || 0); setSaved(false); }} placeholder="0" className="h-14 rounded-xl border-0 bg-white px-4 pr-12 text-right text-xl font-extrabold text-[#1b202a]" /><span className="absolute right-4 top-4 text-sm font-bold text-[#778396]">грн</span></div></div><div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4"><span className="text-sm font-semibold text-[#b9cae4]">5% у зарплату</span><span className="text-xl font-extrabold">{money(calculations.repairsPay)}</span></div></div></div></div><Summary calculation={calculations} saved={saved} onSave={saveReport} onSend={sendReport} onCopy={copyReport} sending={sending} sendMessage={sendMessage} /></section>
  </div> : <Leaders reports={leaderboard} />}</div></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-bold text-[#5b6472]"><span>{label}</span>{children}</label>; }
function ServiceCard({ amount, count, rate, onChange, onCountChange }: { amount: number; count: number; rate: number; onChange: (value: number) => void; onCountChange: (value: number) => void }) { const pay = Math.round(amount * rate / 100); return <div className="rounded-2xl bg-[#183458] p-5 text-white"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-white/12"><Settings2 className="size-5 text-[#8fb8ff]" /></div><div><h2 className="font-extrabold">Послуги</h2><p className="text-sm text-[#b9cae4]">Впишіть суму послуг за зміну</p></div></div><div className="mt-5 grid gap-3"><label className="text-sm font-bold text-[#cfddf3]">Кількість послуг<Stepper compact value={count} onChange={onCountChange} /></label><label className="text-sm font-bold text-[#cfddf3]">Сума послуг<div className="relative mt-2"><Input inputMode="numeric" value={amount || ''} onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="0" className="h-14 rounded-xl border-0 bg-white px-4 pr-12 text-right text-xl font-extrabold text-[#1b202a]" /><span className="absolute right-4 top-4 text-sm font-bold text-[#778396]">грн</span></div></label></div><div className="mt-4 flex items-center justify-between border-t border-white/15 pt-4"><span className="text-sm font-semibold text-[#b9cae4]">{rate}% у зарплату</span><span className="text-xl font-extrabold">{money(pay)}</span></div></div>; }
function Summary({ calculation, saved, onSave, onSend, onCopy, sending, sendMessage }: { calculation: { base: number; techPay: number; accessoriesPay: number; servicesPay: number; repairsPay: number; bonusPay: number; total: number }; saved: boolean; onSave: () => void; onSend: () => void; onCopy: () => void; sending: boolean; sendMessage: string }) { const rows = [['Ставка', calculation.base], ['Техніка', calculation.techPay], ['Аксесуари', calculation.accessoriesPay], ['Послуги', calculation.servicesPay], ['Ремонти · 5%', calculation.repairsPay], ['Бонуси', calculation.bonusPay]]; return <aside className="rounded-3xl bg-white p-6 shadow-[0_12px_35px_rgb(23_30_45/0.08)]"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#eaf0ff] text-[#246bfd]"><ReceiptText className="size-5" /></div><div><h2 className="font-extrabold">Підсумок зміни</h2><p className="text-sm text-[#7a8493]">Нарахування за сьогодні</p></div></div><div className="mt-5 space-y-3">{rows.map(([label, value]) => <div key={String(label)} className="flex justify-between text-sm"><span className="text-[#697483]">{label}</span><span className="font-bold">{money(Number(value))}</span></div>)}</div><div className="mt-5 border-t border-[#e8ebf1] pt-5"><p className="text-sm font-bold text-[#697483]">Разом до зарплати</p><p className="mt-1 text-4xl font-extrabold tracking-tight text-[#246bfd]">{money(calculation.total)}</p></div><Button disabled={sending} onClick={onSend} className="mt-6 h-11 w-full rounded-xl bg-[#246bfd] hover:bg-[#1759da]"><Check /> {sending ? 'Надсилаємо…' : 'Відправити звіт'}</Button>{sendMessage && <p className="mt-3 text-center text-sm font-semibold text-[#526fff]">{sendMessage}</p>}<Button variant="outline" onClick={onSave} className="mt-2 h-10 w-full rounded-xl"><Check /> {saved ? 'Збережено на цьому пристрої' : 'Зберегти на цьому пристрої'}</Button><Button variant="outline" onClick={onCopy} className="mt-2 h-10 w-full rounded-xl"><Copy /> Скопіювати для Telegram</Button></aside>; }
function Leaders({ reports }: { reports: DailyReport[] }) { const best = reports[0]; return <div className="space-y-6"><section className="grid gap-4 sm:grid-cols-3"><Stat tone="crown" icon={<Crown />} label="Лідер за зарплатою" value={best?.employee ?? '—'} /><Stat tone="chart" icon={<BarChart3 />} label="Звітів за сьогодні" value={String(reports.length)} /><Stat tone="reports" icon={<ClipboardCheck />} label="Нараховано команді" value={money(reports.reduce((sum, x) => sum + x.total, 0))} /></section><section className="overflow-hidden rounded-3xl border border-[#e2e6ee] bg-white shadow-[0_10px_30px_rgb(23_30_45/0.04)]"><div className="px-6 py-5"><h2 className="text-xl font-extrabold">Мотиваційна таблиця</h2><p className="mt-1 text-sm text-[#7a8493]">Кожен зберігає свій підсумок наприкінці зміни.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[#f4f6f9] text-xs uppercase tracking-wide text-[#778292]"><tr><th className="px-6 py-3">Місце</th><th className="px-4 py-3">Співробітник</th><th className="px-4 py-3 text-right">Техніка, шт</th><th className="px-4 py-3 text-right">Оборот</th><th className="px-4 py-3 text-right">Ремонти</th><th className="px-6 py-3 text-right">Нараховано</th></tr></thead><tbody>{reports.length ? reports.map((report, index) => <tr key={report.id} className="border-t border-[#edf0f4]"><td className="px-6 py-5 font-extrabold text-[#526fff]">#{index + 1}</td><td className="px-4 py-5 font-extrabold">{report.employee}</td><td className="px-4 py-5 text-right">{report.units}</td><td className="px-4 py-5 text-right">{money(report.turnover)}</td><td className="px-4 py-5 text-right">{money(report.repairs)}</td><td className="px-6 py-5 text-right font-extrabold text-[#246bfd]">{money(report.total)}</td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center text-[#7a8493]">Ще немає збережених звітів.</td></tr>}</tbody></table></div></section></div>; }
function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'crown' | 'chart' | 'reports' }) { return <div className={`cyber-stat cyber-stat-${tone} rounded-3xl border border-[#e2e6ee] bg-white p-5`}><div className="cyber-stat-icon grid size-10 place-items-center rounded-xl bg-[#eaf0ff] text-[#246bfd]">{icon}</div><p className="mt-5 text-sm font-bold text-[#7a8493]">{label}</p><p className="mt-1 text-2xl font-extrabold">{value}</p></div>; }
