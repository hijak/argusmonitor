import { useEffect, useMemo, useState } from "react";
import { getWorkspaceId } from "@/lib/workspace";
import { useEventSourceList } from "@/hooks/useEventSourceList";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface HostStreamOptions {
  type?: string;
  status?: string;
  search?: string;
  enabled?: boolean;
  path?: string;
  limit?: number;
  offset?: number;
}

export function useHostsStream(initialHosts: any[], options: HostStreamOptions = {}) {
  const { type, status, search, enabled = true, path = "/api/hosts/stream", limit, offset } = options;

  const params = useMemo(
    () => ({
      ...(type && type !== "all" ? { type } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(search ? { search } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
    }),
    [limit, offset, search, status, type],
  );

  return useEventSourceList(initialHosts, {
    path,
    eventKey: "hosts",
    enabled,
    params,
  });
}

export function useHostMetricsStream(hostId: string | null, initialData: any, enabled = true, hours = 24) {
  const [data, setData] = useState<any>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const streamUrl = useMemo(() => {
    if (!enabled || !hostId) return null;

    const token = localStorage.getItem("argus_token");
    if (!token) return null;

    const params = new URLSearchParams({ token });
    const workspaceId = getWorkspaceId();
    if (workspaceId) params.set("workspace_id", workspaceId);
    params.set("hours", String(hours));
    return `${API_BASE}/api/hosts/${hostId}/metrics/stream?${params.toString()}`;
  }, [enabled, hostId, hours]);

  useEffect(() => {
    if (!streamUrl) return;

    const source = new EventSource(streamUrl);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload.error) setData(payload);
      } catch {
        // ignore malformed stream payloads
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [streamUrl]);

  return data;
}
