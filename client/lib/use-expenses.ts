"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, expensesApi, type Expense, type PublicUser } from "@/lib/api";

/** Paged expense feed (newest first) with "load more". */
export function useExpenses(opts: { friend?: string; pageSize?: number } = {}) {
  const { friend, pageSize = 20 } = opts;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [people, setPeople] = useState<Record<string, PublicUser>>({});
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const page = await expensesApi.list({ friend, limit: pageSize });
      setExpenses(page.expenses);
      setPeople(page.people);
      setCursor(page.nextCursor);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [friend, pageSize]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await expensesApi.list({ friend, cursor, limit: pageSize });
      setExpenses((prev) => [...prev, ...page.expenses]);
      setPeople((prev) => ({ ...prev, ...page.people }));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, friend, pageSize]);

  return { expenses, people, hasMore: !!cursor, loading, loadingMore, error, reload, loadMore };
}
