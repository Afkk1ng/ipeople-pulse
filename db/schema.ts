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
