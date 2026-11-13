"use client";

import { useCallback, useEffect, useState } from "react";
import { balancesApi, errorMessage, type BalanceSummary } from "@/lib/api";

/** My balances per friend and per currency; refreshes when the tab regains focus. */
export function useBalances() {
  const [data, setData] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setData(await balancesApi.summary());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  return { data, loading, error, reload };
}
