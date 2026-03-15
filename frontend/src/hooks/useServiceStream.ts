import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export function useServicesStream(initialServices: any[], enabled = true) {
  const [services, setServices] = useState<any[]>(initialServices ?? []);

  useEffect(() => {
    setServices(initialServices ?? []);
  }, [initialServices]);

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem("argus_token");
    if (!token) return;

    const source = new EventSource(`${API_BASE}/api/services/stream?token=${encodeURIComponent(token)}`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (Array.isArray(payload.services)) setServices(payload.services);
      } catch {
        // ignore malformed stream payloads
      }
    };
    source.onerror = () => source.close();

    return () => source.close();
  }, [enabled]);

  return services;
}
