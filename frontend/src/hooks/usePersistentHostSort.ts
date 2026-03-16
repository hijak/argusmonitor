import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { HostSortDirection, HostSortKey } from "@/lib/hostSorting";

const VALID_KEYS: HostSortKey[] = ["name", "status", "cpu", "memory", "uptime", "last_seen"];
const VALID_DIRECTIONS: HostSortDirection[] = ["asc", "desc"];

function isValidKey(value: string | null): value is HostSortKey {
  return !!value && VALID_KEYS.includes(value as HostSortKey);
}

function isValidDirection(value: string | null): value is HostSortDirection {
  return !!value && VALID_DIRECTIONS.includes(value as HostSortDirection);
}

interface Options {
  storageKey: string;
  defaultKey: HostSortKey;
  defaultDirection: HostSortDirection;
  queryKey?: string;
  queryDirection?: string;
}

export function usePersistentHostSort({
  storageKey,
  defaultKey,
  defaultDirection,
  queryKey = "hostSort",
  queryDirection = "hostDir",
}: Options) {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlState = useMemo(() => {
    const key = searchParams.get(queryKey);
    const direction = searchParams.get(queryDirection);
    return {
      key: isValidKey(key) ? key : null,
      direction: isValidDirection(direction) ? direction : null,
    };
  }, [searchParams, queryKey, queryDirection]);

  const [sortKey, setSortKey] = useState<HostSortKey>(() => {
    if (urlState.key) return urlState.key;
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (isValidKey(parsed?.key)) return parsed.key;
        } catch {
          // ignore invalid storage
        }
      }
    }
    return defaultKey;
  });

  const [sortDirection, setSortDirection] = useState<HostSortDirection>(() => {
    if (urlState.direction) return urlState.direction;
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (isValidDirection(parsed?.direction)) return parsed.direction;
        } catch {
          // ignore invalid storage
        }
      }
    }
    return defaultDirection;
  });

  useEffect(() => {
    if (urlState.key && urlState.key !== sortKey) setSortKey(urlState.key);
    if (urlState.direction && urlState.direction !== sortDirection) setSortDirection(urlState.direction);
  }, [urlState, sortKey, sortDirection]);

  useEffect(() => {
    const nextKey = urlState.key ?? sortKey;
    const nextDirection = urlState.direction ?? sortDirection;
    if (nextKey === sortKey && nextDirection === sortDirection) return;
  }, [urlState, sortKey, sortDirection]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify({ key: sortKey, direction: sortDirection }));
    }

    const currentKey = searchParams.get(queryKey);
    const currentDirection = searchParams.get(queryDirection);
    if (currentKey === sortKey && currentDirection === sortDirection) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(queryKey, sortKey);
      next.set(queryDirection, sortDirection);
      return next;
    }, { replace: true });
  }, [sortKey, sortDirection, storageKey, searchParams, setSearchParams, queryKey, queryDirection]);

  const toggleSort = (key: HostSortKey) => {
    if (sortKey === key) {
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "name" ? "asc" : key === "status" ? "asc" : "desc");
  };

  return {
    sortKey,
    sortDirection,
    setSortKey,
    setSortDirection,
    toggleSort,
  };
}
