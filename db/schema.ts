import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const reports = sqliteTable('reports', {
  id: text('id').primaryKey(),
  employee: text('employee').notNull(),
  shiftDate: text('shift_date').notNull(),
  submittedAt: integer('submitted_at').notNull(),
  totalPay: integer('total_pay').notNull(),
  payload: text('payload').notNull(),
});
