import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  employee: text('employee').notNull(),
  shiftDate: text('shift_date').notNull(),
  submittedAt: integer('submitted_at').notNull(),
  totalPay: integer('total_pay').notNull(),
  payload: text('payload').notNull(),
});

export const queueEntries = sqliteTable('queue_entries', {
  id: text('id').primaryKey(),
  employee: text('employee').notNull().unique(),
  position: integer('position').notNull(),
  status: text('status').notNull().default('active'),
  updatedAt: integer('updated_at').notNull(),
});

export const queueApproaches = sqliteTable('queue_approaches', {
  id: text('id').primaryKey(),
  employee: text('employee').notNull(),
  shiftDate: text('shift_date').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('idx_queue_approaches_employee_day').on(table.employee, table.shiftDate)]);

export const queueSettings = sqliteTable('queue_settings', {
  key: text('key').primaryKey(),
  value: integer('value').notNull(),
});

export const teamMoods = sqliteTable('team_moods', {
  employee: text('employee').notNull(),
  shiftDate: text('shift_date').notNull(),
  mood: text('mood').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.employee, table.shiftDate] })]);

export const teamNews = sqliteTable('team_news', {
  id: text('id').primaryKey(),
  message: text('message').notNull(),
  author: text('author').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Imported sales are kept separately from the legacy shift reports. A payroll run
// can therefore always be reproduced from the approved source rows it used.
export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  active: integer('active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
});

export const employeeAliases = sqliteTable('employee_aliases', {
  normalizedAlias: text('normalized_alias').primaryKey(),
  employeeId: text('employee_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('idx_employee_aliases_employee').on(table.employeeId)]);

export const employeeColorRules = sqliteTable('employee_color_rules', {
  colorHex: text('color_hex').primaryKey(),
  employeeId: text('employee_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [index('idx_employee_colors_employee').on(table.employeeId)]);

export const salesImports = sqliteTable('sales_imports', {
  id: text('id').primaryKey(),
  sourceTitle: text('source_title').notNull(),
  sourceFingerprint: text('source_fingerprint').notNull(),
  importedAt: integer('imported_at').notNull(),
  importedBy: text('imported_by').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  status: text('status').notNull().default('review'),
});

export const salesRows = sqliteTable('sales_rows', {
  id: text('id').primaryKey(),
  importId: text('import_id').notNull(),
  sourceRowId: text('source_row_id').notNull(),
  saleDate: text('sale_date').notNull(),
  transactionId: text('transaction_id').notNull(),
  itemName: text('item_name').notNull(),
  category: text('category').notNull(),
  amount: integer('amount').notNull(),
  employeeId: text('employee_id'),
  employeeNameRaw: text('employee_name_raw'),
  sourceColor: text('source_color'),
  resolution: text('resolution').notNull(),
  approvedAt: integer('approved_at'),
}, table => [
  index('idx_sales_rows_import').on(table.importId),
  index('idx_sales_rows_employee_date').on(table.employeeId, table.saleDate),
  index('idx_sales_rows_review').on(table.importId, table.resolution),
]);

export const payrollRuleVersions = sqliteTable('payroll_rule_versions', {
  id: text('id').primaryKey(),
  effectiveFrom: text('effective_from').notNull(),
  rulesJson: text('rules_json').notNull(),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by').notNull(),
});
