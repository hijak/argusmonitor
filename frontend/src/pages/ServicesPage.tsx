import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Activity,
  Database,
  Globe,
  HardDrive,
  Radar,
  Server,
  ShieldAlert,
  Unplug,
  Waypoints,
} from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { useServicesStream } from "@/hooks/useServiceStream";
import { ServiceDetailSheet } from "@/components/ServiceDetailSheet";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

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

function formatRpm(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k/min`;
  return `${Math.round(value)}/min`;
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

function summarizeGroupStatus(services: any[]) {
  if (services.some((svc) => normalizeStatus(svc.status) === "critical")) return "critical";
  if (services.some((svc) => normalizeStatus(svc.status) === "warning")) return "warning";
  if (services.some((svc) => normalizeStatus(svc.status) === "healthy")) return "healthy";
  return "unknown";
}

function summaryMetric(label: string, value: string | number, icon: ReactNode) {
  return { label, value, icon };
}

function getServiceIcon(service: any) {
  switch (service.service_type) {
    case "postgresql":
    case "mysql":
      return <Database className="h-4 w-4 shrink-0 text-muted-foreground" />;
    case "redis":
      return <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />;
    case "http":
    case "https":
      return <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />;
    default:
      return <Waypoints className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

function getPluginHealth(service: any) {
  const meta = service.plugin_metadata || {};
  const status = normalizeStatus(service.status);

  if (String(meta.metrics_mode || "").includes("error")) {
    return { variant: status === "critical" ? "critical" : "warning", label: "collector issue" };
  }

  if (service.plugin_id === "postgres") {
    if (Number(meta.replication_lag_seconds || 0) > 30) return { variant: "warning", label: "lagging" };
    if (Number(meta.connection_utilization || 0) > 0.9) return { variant: "warning", label: "high util" };
    if (meta.metrics_mode === "sql") return { variant: "healthy", label: "sql live" };
  }

  if (service.plugin_id === "mysql") {
    if (Number(meta.connection_utilization || 0) > 0.9) return { variant: "warning", label: "high util" };
    if (Number(meta.slow_queries || 0) > 0) return { variant: "warning", label: "slow queries" };
    if (meta.metrics_mode === "sql") return { variant: "healthy", label: "sql live" };
  }

  if (service.plugin_id === "rabbitmq") {
    if (Number(meta.messages_total || 0) > 10000) return { variant: "warning", label: "backlog" };
    if (meta.metrics_mode === "management-api") return { variant: "healthy", label: "api live" };
  }

  if (service.plugin_id === "redis") {
    if (meta.role === "slave" && meta.master_link_status && meta.master_link_status !== "up") {
      return { variant: "warning", label: "replica issue" };
    }
    if (meta.metrics_mode === "info") return { variant: "healthy", label: "info live" };
  }

  return { variant: status, label: service.plugin_id ? "discovered" : "unknown" };
}

function getPluginMetricRows(service: any) {
  const meta = service.plugin_metadata || {};

  switch (service.plugin_id) {
    case "postgres":
      return [
        { label: "DBs", value: meta.database_count ?? service.endpoints_count ?? "—" },
        { label: "Active", value: meta.active_connections ?? "—" },
        { label: "Lag", value: meta.replication_lag_seconds !== undefined ? `${Math.round(Number(meta.replication_lag_seconds || 0))}s` : "—" },
      ];
    case "mysql":
      return [
        { label: "DBs", value: meta.database_count ?? service.endpoints_count ?? "—" },
        { label: "Threads", value: meta.threads_running ?? "—" },
        { label: "Util", value: meta.connection_utilization !== undefined ? `${Math.round(Number(meta.connection_utilization) * 100)}%` : "—" },
      ];
    case "rabbitmq":
      return [
        { label: "Queues", value: meta.queue_count ?? "—" },
        { label: "Msgs", value: meta.messages_total ?? "—" },
        { label: "Nodes", value: meta.node_count ?? "—" },
      ];
    case "redis":
      return [
        { label: "Role", value: meta.role ?? "—" },
        { label: "Clients", value: meta.connected_clients ?? "—" },
        { label: "Memory", value: formatBytes(meta.used_memory) },
      ];
    default:
      return [
        { label: "Type", value: service.service_type || "—" },
        { label: "Plugin", value: service.plugin_id || "—" },
        { label: "Endpoints", value: service.endpoints_count || "—" },
      ];
  }
}

function getPluginFooter(service: any) {
  const meta = service.plugin_metadata || {};

  switch (service.plugin_id) {
    case "postgres":
      return meta.version ? `PG ${String(meta.version).split(" ")[1] || meta.version}` : "PostgreSQL";
    case "mysql":
      return meta.version ? `MySQL ${meta.version}` : "MySQL";
    case "rabbitmq":
      return meta.cluster_name ? `Cluster ${meta.cluster_name}` : "RabbitMQ";
    case "redis":
      return meta.version ? `Redis ${meta.version}` : "Redis";
    default:
      return service.plugin_id ? `plugin:${service.plugin_id}` : "service";
  }
}

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [selectedHost, setSelectedHost] = useState<any | null>(null);
  const { data: serviceSeed = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: api.listServices,
  });
  const { data: hosts = [] } = useQuery({
    queryKey: ["hosts", "services-page"],
    queryFn: () => api.listHosts(),
  });

  const services = useServicesStream(serviceSeed);

  const discoverMutation = useMutation({
    mutationFn: api.discoverServices,
    onSuccess: (result) => {
      toast.success(result.created > 0 ? `Discovered ${result.created} service${result.created === 1 ? "" : "s"}` : "No new services found");
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (error: Error) => toast.error(error.message || "Service discovery failed"),
  });

  const seedAlertsMutation = useMutation({
    mutationFn: api.seedDefaultAlerts,
    onSuccess: (result) => {
      toast.success(result.created > 0 ? `Added ${result.created} default alert rules` : "Default alerts already present");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add default alerts"),
  });

  const hostMap = useMemo(() => {
    const map = new Map<string, any>();
    hosts.forEach((host: any) => map.set(host.id, host));
    return map;
  }, [hosts]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { key: string; host: any | null; services: any[] }>();

    services.forEach((svc: any) => {
      const key = svc.host_id || "unassigned";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          host: svc.host_id ? hostMap.get(svc.host_id) || null : null,
          services: [],
        });
      }
      groups.get(key)!.services.push(svc);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        services: [...group.services].sort((a, b) => {
          const severityRank = { critical: 0, warning: 1, healthy: 2, unknown: 3, info: 4 } as Record<string, number>;
          const aRank = severityRank[normalizeStatus(a.status)] ?? 99;
          const bRank = severityRank[normalizeStatus(b.status)] ?? 99;
          if (aRank !== bRank) return aRank - bRank;
          return String(a.name).localeCompare(String(b.name));
        }),
      }))
      .sort((a, b) => {
        const aStatus = summarizeGroupStatus(a.services);
        const bStatus = summarizeGroupStatus(b.services);
        const severityRank = { critical: 0, warning: 1, healthy: 2, unknown: 3 } as Record<string, number>;
        const diff = (severityRank[aStatus] ?? 99) - (severityRank[bStatus] ?? 99);
        if (diff !== 0) return diff;
        const aName = a.host?.name || "Unassigned";
        const bName = b.host?.name || "Unassigned";
        return aName.localeCompare(bName);
      });
  }, [services, hostMap]);

  const totals = useMemo(() => {
    const critical = services.filter((svc: any) => normalizeStatus(svc.status) === "critical").length;
    const warning = services.filter((svc: any) => normalizeStatus(svc.status) === "warning").length;
    const healthy = services.filter((svc: any) => normalizeStatus(svc.status) === "healthy").length;
    const attachedNodes = new Set(services.map((svc: any) => svc.host_id).filter(Boolean)).size;

    return {
      critical,
      warning,
      healthy,
      total: services.length,
      attachedNodes,
    };
  }, [services]);

  const summaryCards = [
    summaryMetric("Services", totals.total, <Globe className="h-4 w-4 text-primary" />),
    summaryMetric("Nodes with services", totals.attachedNodes, <Server className="h-4 w-4 text-primary" />),
    summaryMetric("Warnings", totals.warning, <Activity className="h-4 w-4 text-warning" />),
    summaryMetric("Critical", totals.critical, <ShieldAlert className="h-4 w-4 text-critical" />),
  ];

  return (
    <motion.div className="space-y-5 p-4 sm:space-y-6 sm:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Services" description="Service health grouped by the nodes they were discovered on.">
          <button
            onClick={() => seedAlertsMutation.mutate()}
            disabled={seedAlertsMutation.isPending}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover disabled:opacity-50"
          >
            <ShieldAlert className="h-4 w-4" />
            {seedAlertsMutation.isPending ? "Adding alerts..." : "Add Default Alerts"}
          </button>
          <button
            onClick={() => discoverMutation.mutate()}
            disabled={discoverMutation.isPending}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Radar className="h-4 w-4" />
            {discoverMutation.isPending ? "Scanning..." : "Discover Services"}
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{card.value}</div>
              </div>
              <div className="rounded-lg bg-surface p-2">{card.icon}</div>
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div variants={item} className="space-y-4">
        {grouped.map((group) => {
          const groupStatus = summarizeGroupStatus(group.services);
          const host = group.host;
          const criticalCount = group.services.filter((svc) => normalizeStatus(svc.status) === "critical").length;
          const warningCount = group.services.filter((svc) => normalizeStatus(svc.status) === "warning").length;

          return (
            <section key={group.key} className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm">
              <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                      {host ? <Server className="h-4 w-4 text-muted-foreground" /> : <Unplug className="h-4 w-4 text-muted-foreground" />}
                      <span className="truncate">{host?.name || "Unassigned / external services"}</span>
                    </div>
                    <StatusBadge variant={normalizeStatus(host?.status || groupStatus)}>
                      {host?.status || groupStatus}
                    </StatusBadge>
                    {host?.type && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{host.type}</span>}
                    {host?.ip_address && <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{host.ip_address}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{group.services.length} service{group.services.length === 1 ? "" : "s"}</span>
                    <span>{group.services.filter((svc) => normalizeStatus(svc.status) === "healthy").length} healthy</span>
                    {warningCount > 0 && <span className="text-warning">{warningCount} warning</span>}
                    {criticalCount > 0 && <span className="text-critical">{criticalCount} critical</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl bg-surface px-3 py-2 text-xs">
                    <div className="text-muted-foreground">Avg latency</div>
                    <div className="mt-1 font-mono text-foreground">
                      {Math.round(group.services.reduce((sum, svc) => sum + Number(svc.latency_ms || 0), 0) / Math.max(group.services.length, 1))}ms
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface px-3 py-2 text-xs">
                    <div className="text-muted-foreground">Traffic</div>
                    <div className="mt-1 font-mono text-foreground">
                      {formatRpm(group.services.reduce((sum, svc) => sum + Number(svc.requests_per_min || 0), 0))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface px-3 py-2 text-xs">
                    <div className="text-muted-foreground">Plugins</div>
                    <div className="mt-1 font-mono text-foreground">
                      {new Set(group.services.map((svc) => svc.plugin_id).filter(Boolean)).size || 0}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface px-3 py-2 text-xs">
                    <div className="text-muted-foreground">Types</div>
                    <div className="mt-1 font-mono text-foreground">
                      {new Set(group.services.map((svc) => svc.service_type).filter(Boolean)).size || 0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 2xl:grid-cols-3">
                {group.services.map((svc: any) => {
                  const status = normalizeStatus(svc.status);
                  const pluginHealth = getPluginHealth(svc);
                  const pluginRows = getPluginMetricRows(svc);
                  return (
                    <article
                      key={svc.id}
                      onClick={() => {
                        setSelectedService(svc);
                        setSelectedHost(host || null);
                      }}
                      className="group cursor-pointer rounded-2xl border border-border bg-background/60 p-3 transition-all hover:border-primary/30 hover:bg-surface-hover sm:p-4"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {getServiceIcon(svc)}
                              <h3 className="truncate text-sm font-medium text-foreground">{svc.name}</h3>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                              {svc.service_type && <span className="rounded bg-muted px-1.5 py-0.5 uppercase tracking-wide">{svc.service_type}</span>}
                              {svc.plugin_id && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">plugin:{svc.plugin_id}</span>}
                              {svc.endpoints_count ? <span className="rounded bg-surface px-1.5 py-0.5">{svc.endpoints_count} endpoint{svc.endpoints_count === 1 ? "" : "s"}</span> : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <StatusBadge variant={status} pulse={status === "critical"}>{svc.status}</StatusBadge>
                            <StatusBadge variant={pluginHealth.variant as any}>{pluginHealth.label}</StatusBadge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <div className="rounded-lg bg-surface px-2.5 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Latency</div>
                            <div className={`mt-1 font-mono text-sm ${Number(svc.latency_ms || 0) > 200 ? "text-critical" : Number(svc.latency_ms || 0) > 100 ? "text-warning" : "text-foreground"}`}>
                              {Math.round(Number(svc.latency_ms || 0))}ms
                            </div>
                          </div>
                          <div className="rounded-lg bg-surface px-2.5 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Traffic</div>
                            <div className="mt-1 font-mono text-sm text-foreground">{formatRpm(Number(svc.requests_per_min || 0))}</div>
                          </div>
                          <div className="rounded-lg bg-surface px-2.5 py-2 col-span-2 sm:col-span-1">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Uptime</div>
                            <div className="mt-1 font-mono text-sm text-foreground">{Number(svc.uptime_percent || 0).toFixed(1)}%</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/70 bg-card/40 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Plugin telemetry</div>
                            <div className="hidden sm:block">
                              <Sparkline
                                data={svc.spark || []}
                                color={status === "critical" ? "hsl(0 84% 60%)" : status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                                width={92}
                                height={28}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            {pluginRows.map((row) => (
                              <div key={row.label} className="rounded-lg bg-surface px-2.5 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{row.label}</div>
                                <div className="mt-1 truncate font-mono text-foreground">{String(row.value)}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-end sm:justify-between">
                          <div className="min-w-0 space-y-1.5">
                            {svc.endpoint && (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0">Endpoint</span>
                                <span className="truncate font-mono text-foreground">{svc.endpoint}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-2">
                              <span className="shrink-0">Collector</span>
                              <span className="truncate text-foreground">{getPluginFooter(svc)}</span>
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground">Tap for full details</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {!isLoading && grouped.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
            No services yet. Run discovery to populate this view.
          </div>
        )}

        {isLoading && <div className="py-8 text-center text-muted-foreground">Loading services...</div>}
      </motion.div>

      <ServiceDetailSheet
        service={selectedService}
        host={selectedHost}
        open={!!selectedService}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedService(null);
            setSelectedHost(null);
          }
        }}
      />
    </motion.div>
  );
}
