export type EmployeeRuleSet = {
  /** Lowercase aliases written in the sheet, mapped to the employee's canonical name. */
  aliases: Record<string, string>;
  /** Six-digit RGB fill (without #), mapped to the employee's canonical name. */
  colorOwners: Record<string, string>;
};

export type EmployeeResolution = {
  employee: string | null;
  source: 'name' | 'color' | 'conflict' | 'unknown';
  requiresReview: boolean;
};

export const emptyEmployeeRules = (): EmployeeRuleSet => ({ aliases: {}, colorOwners: {} });

export function normalizeEmployeeText(value: string) {
  return value.trim().toLocaleLowerCase('uk').replace(/\s+/g, ' ');
}

export function normalizeColor(value: string | null | undefined) {
  return (value ?? '').replace('#', '').trim().toLocaleLowerCase();
}

/**
 * A written name is the primary signal. Color is merely a fallback for rows
 * without a name, so a salesperson can use any highlight color in a sheet.
 */
export function resolveEmployee(cells: Array<string | number | boolean | null | undefined>, fill: string | null | undefined, rules: EmployeeRuleSet): EmployeeResolution {
  const rowText = normalizeEmployeeText(cells.map(value => String(value ?? '')).join(' '));
  const nameOwner = Object.entries(rules.aliases).find(([alias]) => alias && rowText.includes(normalizeEmployeeText(alias)))?.[1] ?? null;
  const colorOwner = rules.colorOwners[normalizeColor(fill)] ?? null;
  if (nameOwner) return { employee: nameOwner, source: 'name', requiresReview: false };
  if (colorOwner) return { employee: colorOwner, source: 'color', requiresReview: false };
  return { employee: null, source: 'unknown', requiresReview: true };
}
