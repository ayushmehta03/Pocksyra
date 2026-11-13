import { expensesApi, type Expense } from "@/lib/api";

/** Loads my expenses for the last `days * 2` days (this window and the one before it). */
export async function loadWindow(days: number, now = new Date()): Promise<Expense[]> {
  const oldest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (2 * days - 1)).getTime();
  const out: Expense[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await expensesApi.list({ limit: 100, cursor });
    out.push(...res.expenses);
    cursor = res.nextCursor;
    const last = res.expenses[res.expenses.length - 1];
    if (!cursor || (last && new Date(last.date).getTime() < oldest)) break; // newest first, so we can stop early
  }
  return out;
}
