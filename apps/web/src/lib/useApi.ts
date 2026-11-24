"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "./api";

/** GET a resource on mount (and when `path` changes); map the raw payload with `map`. */
export function useApi<T>(path: string | null, map: (raw: unknown) => T) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api(path).then((r) => { if (alive) { setData(map(r)); setError(null); } })
      .catch((e) => alive && setError(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // `map` is a stable module-level function; refetch only when the path changes or on reload().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { data, error, loading, reload, setData };
}
