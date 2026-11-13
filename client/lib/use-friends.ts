"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage, friendsApi, type FriendList } from "@/lib/api";

/** Loads the friend list and keeps it fresh when the tab regains focus. */
export function useFriends() {
  const [data, setData] = useState<FriendList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setData(await friendsApi.list());
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
