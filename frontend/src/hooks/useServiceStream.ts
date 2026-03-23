import { useMemo } from "react";
import { useEventSourceList } from "@/hooks/useEventSourceList";

interface ServiceStreamOptions {
  search?: string;
  status?: string;
  hostId?: string;
  pluginId?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
  path?: string;
}

export function useServicesStream(initialServices: any[], options: ServiceStreamOptions = {}) {
  const { search, status, hostId, pluginId, limit, offset, enabled = true, path = "/api/services/stream" } = options;

  const params = useMemo(
    () => ({
      ...(search ? { search } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(hostId ? { host_id: hostId } : {}),
      ...(pluginId && pluginId !== "all" ? { plugin_id: pluginId } : {}),
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
    }),
    [hostId, limit, offset, pluginId, search, status],
  );

  return useEventSourceList(initialServices, {
    path,
    eventKey: "services",
    enabled,
    params,
  });
}
