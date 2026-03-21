import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface HostStreamOptions {
  type?: string;
  status?: string;
  search?: string;
  enabled?: boolean;
}

export function useHostsStream(initialHosts: any[], options: HostStreamOptions = {}) {
  const [hosts, setHosts] = useState<any[]>(initialHosts ?? []);
  const { type, status, search, enabled = true } = options;

  useEffect(() => {
    setHosts(initialHosts ?? []);
  }, [initialHosts]);

  useEffect(() => {
    if (!enabled) return;

    const token = localStorage.getItem("argus_token");
    if (!token) return;

    const params = new URLSearchParams({ token });
    if (type && type !== "all") params.set("type", type);
    if (status) params.set("status", status);
    if (search) params.set("search", search);

    const source = new EventSource(`${API_BASE}/api/hosts/stream?${params.toString()}`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (Array.isArray(payload.hosts)) setHosts(payload.hosts);
      } catch {
        // ignore malformed stream payloads
      }
    };

    source.onerror = () => {
      source.close();
    };

    return () => source.close();
  }, [enabled, search, status, type]);

  return hosts;
}

export function useHostMetricsStream(hostId: string | null, initialData: any, enabled = true) {
  const [data, setData] = useState<any>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!enabled || !hostId) return;

    const token = localStorage.getItem("argus_token");
    if (!token) return;

    const params = new URLSearchParams({ token });
    const source = new EventSource(`${API_BASE}/api/hosts/${hostId}/metrics/stream?${params.toString()}`);
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
  }, [enabled, hostId]);

  return data;
}
