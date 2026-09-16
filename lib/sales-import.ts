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
  return value
    .trim()
    .toLocaleLowerCase('uk')
    .replace(/[’ʼ'`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function differsByAtMostOne(left: string, right: string) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

function aliasMatchesRow(alias: string, rowText: string) {
  const normalizedAlias = normalizeEmployeeText(alias);
  if (!normalizedAlias) return false;
  if (rowText.includes(normalizedAlias)) return true;

  const aliasWords = normalizedAlias.split(' ');
  if (aliasWords.length < 2) return false;
  const rowWords = rowText.split(' ');
  return aliasWords.every((aliasWord) => rowWords.some((rowWord) =>
    aliasWord === rowWord || (aliasWord.length >= 5 && differsByAtMostOne(aliasWord, rowWord)),
  ));
}

/** Employee ownership is determined only by a written name or alias. */
export function resolveEmployee(cells: Array<string | number | boolean | null | undefined>, _fill: string | null | undefined, rules: EmployeeRuleSet): EmployeeResolution {
  const rowText = normalizeEmployeeText(cells.map(value => String(value ?? '')).join(' '));
  const nameOwner = Object.entries(rules.aliases).find(([alias]) => aliasMatchesRow(alias, rowText))?.[1] ?? null;
  if (nameOwner) return { employee: nameOwner, source: 'name', requiresReview: false };
  return { employee: null, source: 'unknown', requiresReview: true };
}
