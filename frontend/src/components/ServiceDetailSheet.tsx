import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import { Activity, Database, Globe, HardDrive, Network, Server, ShieldAlert, Waypoints } from "lucide-react";

function normalizeStatus(status?: string) {
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

function formatValue(value: unknown, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function formatBytes(value: unknown) {
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

function DetailRow({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/50 py-3 text-sm last:border-b-0">
      <div className="text-muted-foreground">{label}</div>
      <div className={`max-w-[60%] text-right text-foreground ${mono ? "font-mono text-xs" : ""}`}>{formatValue(value)}</div>
    </div>
  );
}

function pluginRows(service: any, meta: any) {
  const pluginId = service.plugin_id;

  if (pluginId === "postgres") {
    return [
      { label: "Metrics mode", value: meta.metrics_mode },
      { label: "Version", value: meta.version },
      { label: "DB count", value: meta.database_count },
      { label: "Active connections", value: meta.active_connections },
      { label: "Idle connections", value: meta.idle_connections },
      { label: "Total connections", value: meta.total_connections },
      { label: "Connection util.", value: meta.connection_utilization !== undefined ? `${Math.round(Number(meta.connection_utilization) * 100)}%` : "—" },
      { label: "Replication lag", value: meta.replication_lag_seconds !== undefined ? `${Math.round(Number(meta.replication_lag_seconds || 0))}s` : "—" },
      { label: "Commits", value: meta.xact_commit },
      { label: "Rollbacks", value: meta.xact_rollback },
    ];
  }

  if (pluginId === "mysql") {
    return [
      { label: "Metrics mode", value: meta.metrics_mode },
      { label: "Version", value: meta.version },
      { label: "DB count", value: meta.database_count },
      { label: "Threads running", value: meta.threads_running },
      { label: "Threads connected", value: meta.threads_connected },
      { label: "Connection util.", value: meta.connection_utilization !== undefined ? `${Math.round(Number(meta.connection_utilization) * 100)}%` : "—" },
      { label: "Questions", value: meta.questions },
      { label: "Slow queries", value: meta.slow_queries },
      { label: "Bytes received", value: formatBytes(meta.bytes_received) },
      { label: "Bytes sent", value: formatBytes(meta.bytes_sent) },
    ];
  }

  if (pluginId === "rabbitmq") {
    return [
      { label: "Metrics mode", value: meta.metrics_mode },
      { label: "Version", value: meta.version },
      { label: "Cluster", value: meta.cluster_name },
      { label: "Node count", value: meta.node_count },
      { label: "Queues", value: meta.queue_count },
      { label: "Connections", value: meta.connection_count },
      { label: "Channels", value: meta.channel_count },
      { label: "Consumers", value: meta.consumer_count },
      { label: "Messages ready", value: meta.messages_ready },
      { label: "Unacked", value: meta.messages_unacknowledged },
      { label: "Publish rate", value: meta.publish_rate_per_sec !== undefined ? `${Number(meta.publish_rate_per_sec).toFixed(1)}/s` : "—" },
      { label: "Deliver rate", value: meta.deliver_rate_per_sec !== undefined ? `${Number(meta.deliver_rate_per_sec).toFixed(1)}/s` : "—" },
    ];
  }

  if (pluginId === "redis") {
    return [
      { label: "Metrics mode", value: meta.metrics_mode },
      { label: "Version", value: meta.version },
      { label: "Role", value: meta.role },
      { label: "Connected clients", value: meta.connected_clients },
      { label: "Keys", value: meta.keys },
      { label: "Used memory", value: formatBytes(meta.used_memory) },
      { label: "OPS/sec", value: meta.instantaneous_ops_per_sec !== undefined ? Number(meta.instantaneous_ops_per_sec).toFixed(1) : "—" },
      { label: "Commands total", value: meta.total_commands_processed },
      { label: "Hit rate", value: meta.keyspace_hit_rate !== undefined ? `${Math.round(Number(meta.keyspace_hit_rate) * 100)}%` : "—" },
      { label: "Uptime", value: meta.uptime_in_seconds !== undefined ? `${Math.round(Number(meta.uptime_in_seconds || 0) / 3600)}h` : "—" },
    ];
  }

  return [
    { label: "Plugin", value: service.plugin_id },
    { label: "Service type", value: service.service_type },
    { label: "Suggested", value: meta.suggested === undefined ? "—" : String(meta.suggested) },
    { label: "Discovery source", value: meta.source },
    { label: "Port", value: meta.port },
    { label: "Version", value: meta.version },
  ];
}

export function ServiceDetailSheet({
  service,
  host,
  open,
  onOpenChange,
}: {
  service: any | null;
  host?: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!service) return null;

  const status = normalizeStatus(service.status);
  const meta = service.plugin_metadata || {};
  const detailRows = pluginRows(service, meta).filter((row) => row.value !== undefined && row.value !== null && row.value !== "");
  const metricCards = [
    { label: "Latency", value: `${Math.round(Number(service.latency_ms || 0))}ms`, tone: status === "critical" ? "text-critical" : status === "warning" ? "text-warning" : "text-foreground" },
    { label: "Traffic", value: `${Math.round(Number(service.requests_per_min || 0))}/min`, tone: "text-foreground" },
    { label: "Uptime", value: `${Number(service.uptime_percent || 0).toFixed(1)}%`, tone: "text-foreground" },
    { label: "Endpoints", value: `${service.endpoints_count || 0}`, tone: "text-foreground" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border bg-card p-0 sm:max-w-4xl">
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-6 py-5 backdrop-blur">
          <SheetHeader className="pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface">
                {service.service_type === "postgresql" || service.service_type === "mysql" ? (
                  <Database className="h-5 w-5 text-muted-foreground" />
                ) : service.service_type === "http" || service.service_type === "https" ? (
                  <Globe className="h-5 w-5 text-muted-foreground" />
                ) : service.service_type === "redis" ? (
                  <HardDrive className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Waypoints className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <SheetTitle className="truncate">{service.name}</SheetTitle>
                <SheetDescription className="mt-1">
                  {host?.name ? `Found on ${host.name}` : "Service details"}
                </SheetDescription>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge variant={status} pulse={status === "critical"}>{service.status}</StatusBadge>
              {service.service_type && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{service.service_type}</span>}
              {service.plugin_id && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">plugin:{service.plugin_id}</span>}
              {host?.ip_address && <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{host.ip_address}</span>}
            </div>
          </SheetHeader>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</div>
                <div className={`mt-2 text-2xl font-semibold ${card.tone}`}>{card.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Performance trend
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4">
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Recent service trend based on current telemetry.</div>
                <div className="text-xs">Next step is real per-plugin timeseries, but this is already less useless than a dead card.</div>
              </div>
              <Sparkline
                data={service.spark || []}
                color={status === "critical" ? "hsl(0 84% 60%)" : status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                width={180}
                height={52}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-border bg-background/50 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Network className="h-4 w-4 text-muted-foreground" />
                Connectivity
              </div>
              <DetailRow label="Endpoint" value={service.endpoint} mono />
              <DetailRow label="URL" value={service.url} mono />
              <DetailRow label="Host / node" value={host?.name || "Unassigned"} />
              <DetailRow label="Host IP" value={host?.ip_address} mono />
              <DetailRow label="Host status" value={host?.status} />
              <DetailRow label="Host type" value={host?.type} />
              <DetailRow label="Created" value={service.created_at ? new Date(service.created_at).toLocaleString() : "—"} />
            </div>

            <div className="rounded-2xl border border-border bg-background/50 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Plugin details
              </div>
              {detailRows.map((row) => (
                <DetailRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </div>

          {Object.keys(meta).length > 0 && (
            <div className="rounded-2xl border border-border bg-background/50 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Server className="h-4 w-4 text-muted-foreground" />
                Raw metadata
              </div>
              <pre className="overflow-x-auto rounded-xl bg-surface p-4 text-xs text-foreground">{JSON.stringify(meta, null, 2)}</pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
