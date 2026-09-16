export type EmployeeRuleSet = {
  /** Lowercase aliases written in the sheet, mapped to the employee's canonical name. */
  aliases: Record<string, string>;
};

export type EmployeeResolution = {
  employee: string | null;
  source: 'name' | 'color' | 'conflict' | 'unknown';
  requiresReview: boolean;
};

export const emptyEmployeeRules = (): EmployeeRuleSet => ({ aliases: {} });

export function normalizeEmployeeText(value: string) {
  return value.trim().toLocaleLowerCase('uk').replace(/\s+/g, ' ');
}

/** Employee ownership is determined only by a written name or alias. */
export function resolveEmployee(cells: Array<string | number | boolean | null | undefined>, _fill: string | null | undefined, rules: EmployeeRuleSet): EmployeeResolution {
  const rowText = normalizeEmployeeText(cells.map(value => String(value ?? '')).join(' '));
  const nameOwner = Object.entries(rules.aliases).find(([alias]) => alias && rowText.includes(normalizeEmployeeText(alias)))?.[1] ?? null;
  if (nameOwner) return { employee: nameOwner, source: 'name', requiresReview: false };
  return { employee: null, source: 'unknown', requiresReview: true };
}
