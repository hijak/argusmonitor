export function normalizeStatus(status?: string) {
  switch ((status || "unknown").toLowerCase()) {
    case "healthy":
    case "online":
    case "ok":
      return "healthy" as const;
    case "warning":
    case "degraded":
      return "warning" as const;
    case "critical":
    case "offline":
    case "error":
      return "critical" as const;
    case "info":
      return "info" as const;
    default:
      return "unknown" as const;
  }
}

export function formatBytes(value: unknown) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let current = num;
  while (current >= 1024 && idx < units.length - 1) {
    current /= 1024;
    idx += 1;
  }
  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[idx]}`;
}

export function formatMetricValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (key.includes("bytes") || key === "used_memory") return formatBytes(value);
  if (key.includes("utilization") || key === "keyspace_hit_rate") return `${Math.round(Number(value) * 100)}%`;
  if (key.includes("_per_sec")) return `${Number(value).toFixed(1)}/s`;
  if (key.includes("lag_seconds")) return `${Math.round(Number(value || 0))}s`;
  if (key === "uptime_in_seconds") return `${Math.round(Number(value || 0) / 3600)}h`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function humanizeMetricLabel(key: string) {
  const special: Record<string, string> = {
    metrics_mode: "Metrics mode",
    database_count: "DB count",
    active_connections: "Active connections",
    idle_connections: "Idle connections",
    total_connections: "Total connections",
    connection_utilization: "Connection util.",
    replication_lag_seconds: "Replication lag",
    xact_commit: "Commits",
    xact_rollback: "Rollbacks",
    threads_running: "Threads running",
    threads_connected: "Threads connected",
    slow_queries: "Slow queries",
    bytes_received: "Bytes received",
    bytes_sent: "Bytes sent",
    cluster_name: "Cluster",
    node_count: "Node count",
    queue_count: "Queues",
    connection_count: "Connections",
    channel_count: "Channels",
    consumer_count: "Consumers",
    messages_ready: "Messages ready",
    messages_unacknowledged: "Unacked",
    publish_rate_per_sec: "Publish rate",
    deliver_rate_per_sec: "Deliver rate",
    connected_clients: "Connected clients",
    used_memory: "Used memory",
    instantaneous_ops_per_sec: "OPS/sec",
    total_commands_processed: "Commands total",
    keyspace_hit_rate: "Hit rate",
    uptime_in_seconds: "Uptime",
  };
  if (special[key]) return special[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export function getPluginContract(service: any) {
  return service?.plugin_metadata?.plugin_contract || null;
}

export function getContractMetricRows(service: any) {
  const meta = service?.plugin_metadata || {};
  const contract = getPluginContract(service);
  const keys = contract?.ui?.summaryMetrics;
  if (!Array.isArray(keys) || !keys.length) return null;
  return keys.map((key: string) => ({
    label: humanizeMetricLabel(key),
    value: formatMetricValue(key, meta[key]),
  }));
}

export function getContractDetailRows(service: any) {
  const meta = service?.plugin_metadata || {};
  const contract = getPluginContract(service);
  const keys = contract?.ui?.detailRows;
  if (!Array.isArray(keys) || !keys.length) return null;
  return keys.map((key: string) => ({
    label: humanizeMetricLabel(key),
    value: formatMetricValue(key, meta[key]),
  }));
}

export function getContractHealth(service: any) {
  const meta = service?.plugin_metadata || {};
  const contract = getPluginContract(service);
  const keys = contract?.ui?.healthSignals;
  const status = normalizeStatus(service?.status);
  if (!Array.isArray(keys) || !keys.length) return null;

  if (String(meta.metrics_mode || "").includes("error")) {
    return { variant: status === "critical" ? "critical" : "warning", label: "collector issue" };
  }
  if (keys.includes("connection_utilization") && Number(meta.connection_utilization || 0) > 0.9) {
    return { variant: "warning", label: "high util" };
  }
  if (keys.includes("replication_lag_seconds") && Number(meta.replication_lag_seconds || 0) > 30) {
    return { variant: "warning", label: "lagging" };
  }
  if (keys.includes("slow_queries") && Number(meta.slow_queries || 0) > 0) {
    return { variant: "warning", label: "slow queries" };
  }
  if (keys.includes("messages_total") && Number(meta.messages_total || 0) > 10000) {
    return { variant: "warning", label: "backlog" };
  }
  if (keys.includes("master_link_status") && meta.role === "slave" && meta.master_link_status && meta.master_link_status !== "up") {
    return { variant: "warning", label: "replica issue" };
  }
  if (meta.metrics_mode === "sql") return { variant: "healthy", label: "sql live" };
  if (meta.metrics_mode === "info") return { variant: "healthy", label: "info live" };
  if (meta.metrics_mode === "management-api") return { variant: "healthy", label: "api live" };

  return { variant: status, label: service?.plugin_id ? "discovered" : "unknown" };
}

export function getPluginDisplayTitle(service: any) {
  const meta = service?.plugin_metadata || {};
  const contract = getPluginContract(service);
  if (contract?.ui?.title) return contract.ui.title;
  if (meta.display_name) return String(meta.display_name);
  if (service?.name) return String(service.name);
  if (service?.plugin_id) return `plugin:${service.plugin_id}`;
  return "service";
}

export function getPluginFooter(service: any) {
  const meta = service?.plugin_metadata || {};
  const contract = getPluginContract(service);
  if (contract?.ui?.title) {
    if (meta.version) return `${contract.ui.title} ${meta.version}`;
    return contract.ui.title;
  }
  return service?.plugin_id ? `plugin:${service.plugin_id}` : "service";
}
