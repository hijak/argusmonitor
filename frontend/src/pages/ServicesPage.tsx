import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { FilterBar, FilterStat } from "@/components/FilterBar";
import { DenseCardRow } from "@/components/DenseList";
import { EmptyState, LoadingState } from "@/components/StateBlock";
import { PagerBar, PagerMeta, PagerSummary } from "@/components/PagerBar";
import { MetricCard } from "@/components/MetricCard";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  Database,
  Globe,
  HardDrive,
  LayoutGrid,
  List,
  Radar,
  Search,
  Server,
  ShieldAlert,
  Unplug,
  Waypoints,
} from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { ServiceDetailSheet } from "@/components/ServiceDetailSheet";
import { useServicesStream } from "@/hooks/useServiceStream";
import { getContractHealth, getContractMetricRows, getPluginFooter, normalizeStatus } from "@/lib/pluginUi";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };
const PAGE_SIZE = 100;

function formatRpm(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k/min`;
  return `${Math.round(value)}/min`;
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

function getServicePorts(service: any): string[] {
  const metadata = service?.plugin_metadata || {};
  const rawPorts = metadata.ports || metadata.published_ports || metadata.exposed_ports || metadata.port_list || [];

  if (Array.isArray(rawPorts) && rawPorts.length > 0) {
    return rawPorts
      .map((port: any) => {
        if (port == null) return null;
        if (typeof port === "string" || typeof port === "number") return String(port);
        if (typeof port === "object") {
          if (port.published && port.target) return `${port.published}→${port.target}${port.protocol ? `/${port.protocol}` : ""}`;
          if (port.port && port.targetPort) return `${port.port}→${port.targetPort}${port.protocol ? `/${port.protocol}` : ""}`;
          if (port.port) return `${port.port}${port.protocol ? `/${port.protocol}` : ""}`;
          if (port.published) return `${port.published}${port.protocol ? `/${port.protocol}` : ""}`;
        }
        return null;
      })
      .filter(Boolean);
  }

  const explicitPort = metadata.port;
  if (explicitPort) return [String(explicitPort)];

  const endpoint = service?.endpoint || service?.url || "";
  if (typeof endpoint === "string") {
    const matches = [...endpoint.matchAll(/:(\d{2,5})(?=$|\/|,|\s)/g)].map((m) => m[1]);
    if (matches.length > 0) return Array.from(new Set(matches));
  }

  return [];
}

function formatPortsSummary(service: any) {
  const ports = getServicePorts(service);
  if (ports.length === 0) return { short: "—", full: "", hasPorts: false };
  const short = ports.length > 2 ? `${ports.slice(0, 2).join(", ")} +${ports.length - 2}` : ports.join(", ");
  return { short, full: ports.join(", "), hasPorts: true };
}

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"cards" | "compact">("cards");
  const [page, setPage] = useState(0);

  const { data: serviceResponse, isLoading } = useQuery({
    queryKey: ["services", { search, statusFilter, page }],
    queryFn: () =>
      api.listServices({
        search: search || undefined,
        status: statusFilter,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  const servicesSeed = serviceResponse?.items || [];
  const totalServices = serviceResponse?.total || 0;
  const services = useServicesStream(servicesSeed, {
    search: search || undefined,
    status: statusFilter,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    enabled: !isLoading,
  });
  const totalPages = Math.max(1, Math.ceil(totalServices / PAGE_SIZE));

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

  const toHostSummary = (service: any) => {
    if (!service?.host_id) return null;
    return {
      id: service.host_id,
      name: service.host_name,
      status: service.host_status,
      type: service.host_type,
      ip_address: service.host_ip_address,
    };
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, { key: string; host: any | null; services: any[] }>();

    services.forEach((svc: any) => {
      const key = svc.host_id || "unassigned";
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          host: toHostSummary(svc),
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
  }, [services]);

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
    summaryMetric("Visible services", totals.total, <Globe className="h-4 w-4 text-primary" />),
    summaryMetric("All services", totalServices, <Server className="h-4 w-4 text-primary" />),
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
          <MetricCard key={card.label} label={card.label} value={card.value} icon={card.icon} className="p-4" />
        ))}
      </motion.div>

      <motion.div variants={item}>
        <FilterBar className="grid gap-3 lg:grid-cols-[1fr_220px_220px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search services, endpoints, URLs"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="healthy">Healthy</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex min-h-10 items-center gap-1 rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compact")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${viewMode === "compact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-4 w-4" />
              Compact
            </button>
          </div>
          <FilterStat label="Page" value={`${page + 1} / ${totalPages}`} />
        </FilterBar>
      </motion.div>

      <motion.div variants={item} className="space-y-4">
        {viewMode === "compact" ? (
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-sm">
            <div className="overflow-x-auto">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%] min-w-[240px]">Service</TableHead>
                    <TableHead className="w-[110px]">Status</TableHead>
                    <TableHead className="w-[20%] min-w-[160px]">Host</TableHead>
                    <TableHead className="w-[90px]">Latency</TableHead>
                    <TableHead className="w-[90px] hidden xl:table-cell">Traffic</TableHead>
                    <TableHead className="w-[110px]">Ports</TableHead>
                    <TableHead className="w-[90px] hidden lg:table-cell">Uptime</TableHead>
                    <TableHead className="w-[90px] hidden 2xl:table-cell">Type</TableHead>
                    <TableHead className="w-[110px] hidden 2xl:table-cell">Plugin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((svc: any) => {
                    const status = normalizeStatus(svc.status);
                    const ports = formatPortsSummary(svc);
                    return (
                      <TableRow
                        key={svc.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedService(svc)}
                      >
                        <TableCell className="max-w-0">
                          <div className="min-w-0 max-w-full overflow-hidden">
                            <div className="flex min-w-0 items-center gap-2">
                              {getServiceIcon(svc)}
                              <span className="truncate font-medium text-foreground">{svc.name}</span>
                            </div>
                            {svc.endpoint && (
                              <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{svc.endpoint}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap"><StatusBadge variant={status}>{svc.status}</StatusBadge></TableCell>
                        <TableCell className="max-w-0">
                          <div className="min-w-0 max-w-full overflow-hidden text-sm text-foreground truncate">{svc.host_name || "Unassigned"}</div>
                          {svc.host_ip_address && <div className="truncate font-mono text-xs text-muted-foreground">{svc.host_ip_address}</div>}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap ${Number(svc.latency_ms || 0) > 200 ? "text-critical" : Number(svc.latency_ms || 0) > 100 ? "text-warning" : "text-foreground"}`}>
                          {Math.round(Number(svc.latency_ms || 0))}ms
                        </TableCell>
                        <TableCell className="whitespace-nowrap hidden xl:table-cell">{formatRpm(Number(svc.requests_per_min || 0))}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {ports.hasPorts ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="max-w-[96px] truncate font-mono text-xs text-muted-foreground">
                                  {ports.short}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-sm whitespace-pre-wrap font-mono text-xs">{ports.full}</div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap hidden lg:table-cell">{Number(svc.uptime_percent || 0).toFixed(1)}%</TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          {svc.service_type ? <span className="inline-block max-w-[88px] truncate rounded bg-muted px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">{svc.service_type}</span> : "—"}
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          {svc.plugin_id ? <span className="inline-block max-w-[104px] truncate rounded bg-primary/10 px-2 py-1 text-[11px] text-primary">{svc.plugin_id}</span> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          grouped.map((group) => {
            const groupStatus = summarizeGroupStatus(group.services);
            const host = group.host;
            const criticalCount = group.services.filter((svc) => normalizeStatus(svc.status) === "critical").length;
            const warningCount = group.services.filter((svc) => normalizeStatus(svc.status) === "warning").length;

            return (
              <section key={group.key} className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-sm">
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
                  <div className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs">
                    <div className="text-muted-foreground">Avg latency</div>
                    <div className="mt-1 font-mono text-foreground">
                      {Math.round(group.services.reduce((sum, svc) => sum + Number(svc.latency_ms || 0), 0) / Math.max(group.services.length, 1))}ms
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs">
                    <div className="text-muted-foreground">Traffic</div>
                    <div className="mt-1 font-mono text-foreground">
                      {formatRpm(group.services.reduce((sum, svc) => sum + Number(svc.requests_per_min || 0), 0))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs">
                    <div className="text-muted-foreground">Plugins</div>
                    <div className="mt-1 font-mono text-foreground">
                      {new Set(group.services.map((svc) => svc.plugin_id).filter(Boolean)).size || 0}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-surface px-3 py-2 text-xs">
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
                  const pluginHealth = getContractHealth(svc) || {
                    variant: status,
                    label: svc.plugin_id ? "discovered" : "unknown",
                  };
                  const pluginRows = getContractMetricRows(svc) || [
                    { label: "Type", value: svc.service_type || "—" },
                    { label: "Plugin", value: svc.plugin_id || "—" },
                    { label: "Endpoints", value: svc.endpoints_count || "—" },
                  ];
                  return (
                    <DenseCardRow
                      key={svc.id}
                      className="group cursor-pointer"
                    >
                      <div
                        onClick={() => {
                          setSelectedService(svc);
                        }}
                        className="flex flex-col gap-3"
                      >
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

                        <div className="grid grid-cols-1 gap-2 xs:grid-cols-2 sm:grid-cols-3">
                          <div className="rounded-xl border border-border/60 bg-surface px-2.5 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Latency</div>
                            <div className={`mt-1 font-mono text-sm ${Number(svc.latency_ms || 0) > 200 ? "text-critical" : Number(svc.latency_ms || 0) > 100 ? "text-warning" : "text-foreground"}`}>
                              {Math.round(Number(svc.latency_ms || 0))}ms
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-surface px-2.5 py-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Traffic</div>
                            <div className="mt-1 font-mono text-sm text-foreground">{formatRpm(Number(svc.requests_per_min || 0))}</div>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-surface px-2.5 py-2 col-span-2 sm:col-span-1">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Uptime</div>
                            <div className="mt-1 font-mono text-sm text-foreground">{Number(svc.uptime_percent || 0).toFixed(1)}%</div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/70 bg-card/50 p-3">
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
                          <div className="grid grid-cols-1 gap-2 text-xs xs:grid-cols-2 sm:grid-cols-3">
                            {pluginRows.map((row) => (
                              <div key={row.label} className="rounded-xl border border-border/60 bg-surface px-2.5 py-2">
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
                    </DenseCardRow>
                  );
                })}
              </div>
            </section>
            );
          })
        )}

        {!isLoading && grouped.length === 0 && <EmptyState message="No services found for this filter." />}

        {isLoading && <LoadingState message="Loading services..." className="px-0" />}
      </motion.div>

      <motion.div variants={item}>
        <PagerBar>
          <PagerSummary>
            Showing <span className="font-medium text-foreground">{services.length}</span> of <span className="font-medium text-foreground">{totalServices}</span> services
          </PagerSummary>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <PagerMeta>
              Page <span className="font-medium text-foreground">{page + 1}</span> / {totalPages}
            </PagerMeta>
            <button
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </PagerBar>
      </motion.div>

      <ServiceDetailSheet
        service={selectedService}
        host={selectedService ? toHostSummary(selectedService) : null}
        open={!!selectedService}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedService(null);
          }
        }}
      />
    </motion.div>
  );
}
