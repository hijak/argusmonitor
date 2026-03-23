import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import { DetailPanelSection, DetailStatCard } from "@/components/DetailPanel";
import { api } from "@/lib/api";
import { Activity, Database, Globe, HardDrive, Network, Server, ShieldAlert, TrendingDown, TrendingUp, Waypoints } from "lucide-react";

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

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
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

const historyRanges = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
] as const;

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
  const [rangeHours, setRangeHours] = useState<number>(24);

  const { data: history = [] } = useQuery({
    queryKey: ["service-history", service?.id, rangeHours],
    queryFn: () => api.getServiceHistory(service.id, rangeHours),
    enabled: !!service?.id && open,
    refetchInterval: open ? 30000 : false,
  });

  if (!service) return null;

  const status = normalizeStatus(service.status);
  const meta = service.plugin_metadata || {};
  const sparkData = (history.length ? history.map((point: any) => Number(point.latency_ms)) : (service.spark || []).map((value: any) => Number(value))).filter((value: number) => Number.isFinite(value));
  const detailRows = pluginRows(service, meta).filter((row) => row.value !== undefined && row.value !== null && row.value !== "");
  const metricCards = [
    { label: "Latency", value: `${Math.round(Number(service.latency_ms || 0))}ms`, tone: status === "critical" ? "text-critical" : status === "warning" ? "text-warning" : "text-foreground" },
    { label: "Traffic", value: `${Math.round(Number(service.requests_per_min || 0))}/min`, tone: "text-foreground" },
    { label: "Uptime", value: `${Number(service.uptime_percent || 0).toFixed(1)}%`, tone: "text-foreground" },
    { label: "Endpoints", value: `${service.endpoints_count || 0}`, tone: "text-foreground" },
  ];

  const currentLatency = sparkData.length ? sparkData[sparkData.length - 1] : Number(service.latency_ms || 0);
  const firstLatency = sparkData.length ? sparkData[0] : currentLatency;
  const minLatency = sparkData.length ? Math.min(...sparkData) : currentLatency;
  const maxLatency = sparkData.length ? Math.max(...sparkData) : currentLatency;
  const delta = currentLatency - firstLatency;
  const deltaAbs = Math.abs(delta);
  const trendDirection = delta > 5 ? "up" : delta < -5 ? "down" : "flat";
  const trendTone = trendDirection === "up" ? "text-critical" : trendDirection === "down" ? "text-success" : "text-muted-foreground";
  const trendLabel = trendDirection === "up" ? "Latency rising" : trendDirection === "down" ? "Latency improving" : "Stable";
  const TrendIcon = trendDirection === "up" ? TrendingUp : trendDirection === "down" ? TrendingDown : Activity;
  const sparkColor = status === "critical" ? "hsl(0 84% 60%)" : status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)";
  const latestPointTime = history.length ? new Date(history[history.length - 1].recorded_at).toLocaleString() : null;

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
              <DetailStatCard key={card.label} label={card.label} value={card.value} tone={card.tone} className="bg-background/60" />
            ))}
          </div>

          <DetailPanelSection
            title="Performance trend"
            icon={<Activity className="h-4 w-4" />}
            actions={
              <div className="flex items-center gap-2">
                {historyRanges.map((range) => (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => setRangeHours(range.hours)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${rangeHours === range.hours ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            }
            className="bg-background/50"
          >
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Latency trend</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="text-3xl font-semibold text-foreground">{formatMs(currentLatency)}</div>
                      <div className={`inline-flex items-center gap-1 rounded-full bg-background px-2 py-1 text-xs font-medium ${trendTone}`}>
                        <TrendIcon className="h-3.5 w-3.5" />
                        {trendLabel}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      {trendDirection === "flat"
                        ? "No major latency movement across recent samples."
                        : `${delta > 0 ? "+" : "-"}${formatMs(deltaAbs)} vs earliest sample.`}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {history.length ? `${history.length} samples in last ${rangeHours >= 24 ? `${Math.round(rangeHours / 24)}d` : `${rangeHours}h`}${latestPointTime ? ` • latest ${latestPointTime}` : ""}` : "Using current service telemetry until history fills in."}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Sparkline data={sparkData} color={sparkColor} width={220} height={72} className="w-full sm:w-auto" />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Current</div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{formatMs(currentLatency)}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Range</div>
                  <div className="mt-2 text-xl font-semibold text-foreground">{formatMs(minLatency)}–{formatMs(maxLatency)}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Delta</div>
                  <div className={`mt-2 text-xl font-semibold ${trendTone}`}>
                    {trendDirection === "flat" ? "Stable" : `${delta > 0 ? "+" : "-"}${formatMs(deltaAbs)}`}
                  </div>
                </div>
              </div>
            </div>
          </DetailPanelSection>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <DetailPanelSection title="Connectivity" icon={<Network className="h-4 w-4" />} className="bg-background/50" contentClassName="pt-1 sm:pt-2">
              <DetailRow label="Endpoint" value={service.endpoint} mono />
              <DetailRow label="URL" value={service.url} mono />
              <DetailRow label="Host / node" value={host?.name || "Unassigned"} />
              <DetailRow label="Host IP" value={host?.ip_address} mono />
              <DetailRow label="Host status" value={host?.status} />
              <DetailRow label="Host type" value={host?.type} />
              <DetailRow label="Created" value={service.created_at ? new Date(service.created_at).toLocaleString() : "—"} />
            </DetailPanelSection>

            <DetailPanelSection title="Plugin details" icon={<ShieldAlert className="h-4 w-4" />} className="bg-background/50" contentClassName="pt-1 sm:pt-2">
              {detailRows.map((row) => (
                <DetailRow key={row.label} label={row.label} value={row.value} />
              ))}
            </DetailPanelSection>
          </div>

          {Object.keys(meta).length > 0 && (
            <DetailPanelSection title="Raw metadata" icon={<Server className="h-4 w-4" />} className="bg-background/50">
              <pre className="overflow-x-auto rounded-xl bg-surface p-4 text-xs text-foreground">{JSON.stringify(meta, null, 2)}</pre>
            </DetailPanelSection>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
