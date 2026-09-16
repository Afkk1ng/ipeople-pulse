# Import and payroll architecture

1. The browser receives read-only access to the source sales sheet and never changes it.
2. Each row is normalized into a sale: date, receipt, item, amount, category, staff-name signal, and fill-color signal.
3. Name aliases have priority; color is an independent cross-check. Missing or conflicting ownership is queued for review and is never silently assigned.
4. After confirmation, imports will be stored as immutable batches with their original row metadata. Employee mappings and payroll rules will be versioned separately.
5. Payroll is calculated from approved normalized rows only, allowing a reproducible per-employee monthly result and a clear audit trail.

The planned durable tables are `employees`, `employee_aliases`, `employee_color_rules`, `sales_imports`, `sales_rows`, `import_exceptions`, and `payroll_rule_versions`. Existing `reports`, queue, mood, and news tables remain untouched for historical continuity.
