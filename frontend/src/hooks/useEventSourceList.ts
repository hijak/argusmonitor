import { useEffect, useMemo, useState } from "react";
import { getWorkspaceId } from "@/lib/workspace";

const API_BASE = import.meta.env.VITE_API_URL || "";

function buildStreamUrl(path: string, params: Record<string, string | number | null | undefined>) {
  const token = localStorage.getItem("argus_token");
  if (!token) return null;

  const query = new URLSearchParams({ token });
  const workspaceId = getWorkspaceId();
  if (workspaceId) query.set("workspace_id", workspaceId);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }

  return `${API_BASE}${path}?${query.toString()}`;
}

export function useEventSourceList<T>(
  initialItems: T[],
  options: {
    path: string;
    eventKey: string;
    enabled?: boolean;
    params?: Record<string, string | number | null | undefined>;
  },
) {
  const [items, setItems] = useState<T[]>(initialItems ?? []);
  const { path, eventKey, enabled = true, params = {} } = options;

  useEffect(() => {
    setItems(initialItems ?? []);
  }, [initialItems]);

  const streamUrl = useMemo(() => buildStreamUrl(path, params), [path, params]);

  useEffect(() => {
    if (!enabled || !streamUrl) return;

    const source = new EventSource(streamUrl);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (Array.isArray(payload[eventKey])) setItems(payload[eventKey]);
      } catch {
        // ignore malformed stream payloads
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [enabled, eventKey, streamUrl]);

  return items;
}
