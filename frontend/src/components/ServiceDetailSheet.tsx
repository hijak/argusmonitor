import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { DetailPanelSection, DetailStatCard } from "@/components/DetailPanel";
import { api } from "@/lib/api";
import { getContractDetailRows, normalizeStatus } from "@/lib/pluginUi";
import {
  Activity,
  Database,
  Gauge,
  Globe,
  HardDrive,
  Network,
  Server,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Waypoints,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusBar } from "@/components/blocks/status-bar";
import { StatusBanner } from "@/components/blocks/status-banner";
import {
  StatusComponent,
  StatusComponentBody,
  StatusComponentFooter,
  StatusComponentHeader,
  StatusComponentHeaderLeft,
  StatusComponentHeaderRight,
  StatusComponentStatus,
  StatusComponentTitle,
  StatusComponentUptime,
} from "@/components/blocks/status-component";
import type { StatusBarData, StatusType } from "@/components/blocks/status.types";

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

function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

function formatRpm(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k/min`;
  return `${Math.round(value)}/min`;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function DetailRow({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-3 text-sm last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-left text-foreground sm:max-w-[60%] sm:text-right ${mono ? "font-mono text-xs" : ""}`}>{formatValue(value)}</div>
    </div>
  );
}

function MetricTrendChart({
  title,
  subtitle,
  data,
  dataKey,
  color,
  formatValue,
  height = 220,
  domain,
}: {
  title: string;
  subtitle?: string;
  data: Array<Record<string, number | string | null>>;
  dataKey: string;
  color: string;
  formatValue: (value: number) => string;
  height?: number;
  domain?: [number | string, number | string];
}) {
  const gradientId = `service-chart-${title.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(20 6% 20%)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(25 4% 64%)" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(25 4% 64%)" }}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={domain}
            tickFormatter={(value) => formatValue(Number(value)).replace("/min", "")}
          />
          <Tooltip
            formatter={(value: number) => [formatValue(Number(value)), title]}
            contentStyle={{
              background: "hsl(20 8% 15%)",
              border: "1px solid hsl(20 6% 25%)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function mapStatusForOpenStatus(status: string, uptime: number): Exclude<StatusType, "empty"> {
  if (status === "critical") return "error";
  if (status === "warning") return "degraded";
  if (uptime < 99) return "degraded";
  return "success";
}

function buildStatusBarData(points: any[], rangeHours: number): StatusBarData[] {
  const grouped = new Map<string, any[]>();
  for (const point of points) {
    const recordedAt = point.recorded_at ? new Date(point.recorded_at) : new Date();
    const dayKey = recordedAt.toISOString().slice(0, 10);
    if (!grouped.has(dayKey)) grouped.set(dayKey, []);
    grouped.get(dayKey)?.push(point);
  }

  const maxBars = Math.max(1, Math.min(30, Math.ceil(rangeHours / 24)));
  const days: string[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  for (let i = maxBars - 1; i >= 0; i -= 1) {
    const day = new Date(cursor);
    day.setUTCDate(cursor.getUTCDate() - i);
    days.push(day.toISOString().slice(0, 10));
  }

  return days.map((day) => {
    const dayPoints = grouped.get(day) || [];

    if (!dayPoints.length) {
      return {
        day,
        bar: [{ status: "empty" as const, height: 100 }],
        card: [
          { status: "empty" as const, value: "No uptime data" },
          { status: "empty" as const, value: "No latency data" },
          { status: "empty" as const, value: "No traffic data" },
        ],
        events: [],
      };
    }

    const avgUptime = average(dayPoints.map((point) => Number(point.uptime_percent || 0)));
    const avgLatency = average(dayPoints.map((point) => Number(point.latency_ms || 0)));
    const avgRpm = average(dayPoints.map((point) => Number(point.requests_per_min || 0)));

    const dominantStatus: Exclude<StatusType, "empty"> =
      avgUptime <= 98 ? "error" : avgUptime < 99.9 ? "degraded" : "success";

    return {
      day,
      bar: [{ status: dominantStatus, height: 100 }],
      card: [
        { status: dominantStatus, value: `${formatPercent(avgUptime, 2)} avg uptime` },
        { status: dominantStatus, value: `${formatMs(avgLatency)} avg latency` },
        { status: dominantStatus, value: `${formatRpm(avgRpm)} avg traffic` },
      ],
      events: [],
    };
  });
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

  const { data: availabilityHistory = [] } = useQuery({
    queryKey: ["service-availability-history", service?.id, 24 * 30],
    queryFn: () => api.getServiceHistory(service.id, 24 * 30),
    enabled: !!service?.id && open,
    refetchInterval: open ? 30000 : false,
  });

  if (!service) return null;

  const status = normalizeStatus(service.status);
  const meta = service.plugin_metadata || {};
  const detailRows = (getContractDetailRows(service) || [
    { label: "Plugin", value: service.plugin_id },
    { label: "Service type", value: service.service_type },
    { label: "Suggested", value: meta.suggested === undefined ? "—" : String(meta.suggested) },
    { label: "Discovery source", value: meta.source },
    { label: "Port", value: meta.port },
    { label: "Version", value: meta.version },
  ]).filter((row) => row.value !== undefined && row.value !== null && row.value !== "");

  const points = history.length
    ? history
    : [
        {
          recorded_at: service.updated_at || service.created_at || new Date().toISOString(),
          latency_ms: Number(service.latency_ms || 0),
          requests_per_min: Number(service.requests_per_min || 0),
          uptime_percent: Number(service.uptime_percent || 0),
        },
      ];

  const availabilityPoints = availabilityHistory.length
    ? availabilityHistory
    : points;

  const chartData = points.map((point: any) => ({
    time: point.recorded_at
      ? new Date(point.recorded_at).toLocaleTimeString(
          [],
          rangeHours > 24
            ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
            : { hour: "2-digit", minute: "2-digit" },
        )
      : "—",
    latency: Number(point.latency_ms || 0),
    rpm: Number(point.requests_per_min || 0),
    uptime: Number(point.uptime_percent || 0),
    recordedAt: point.recorded_at || null,
  }));

  const latencySeries = chartData.map((point) => point.latency).filter((value) => Number.isFinite(value));
  const rpmSeries = chartData.map((point) => point.rpm).filter((value) => Number.isFinite(value));
  const uptimeSeries = chartData.map((point) => point.uptime).filter((value) => Number.isFinite(value));

  const currentLatency = latencySeries.length ? latencySeries[latencySeries.length - 1] : Number(service.latency_ms || 0);
  const currentRpm = rpmSeries.length ? rpmSeries[rpmSeries.length - 1] : Number(service.requests_per_min || 0);
  const currentUptime = uptimeSeries.length ? uptimeSeries[uptimeSeries.length - 1] : Number(service.uptime_percent || 0);
  const firstLatency = latencySeries.length ? latencySeries[0] : currentLatency;
  const latencyDelta = currentLatency - firstLatency;
  const latencyDeltaAbs = Math.abs(latencyDelta);
  const trendDirection = latencyDelta > 5 ? "up" : latencyDelta < -5 ? "down" : "flat";
  const trendTone = trendDirection === "up" ? "text-critical" : trendDirection === "down" ? "text-success" : "text-muted-foreground";
  const trendLabel = trendDirection === "up" ? "Latency rising" : trendDirection === "down" ? "Latency improving" : "Stable";
  const TrendIcon = trendDirection === "up" ? TrendingUp : trendDirection === "down" ? TrendingDown : Activity;
  const latestPointTime = chartData.length && chartData[chartData.length - 1]?.recordedAt ? new Date(String(chartData[chartData.length - 1].recordedAt)).toLocaleString() : null;

  const latencyMin = latencySeries.length ? Math.min(...latencySeries) : currentLatency;
  const latencyMax = latencySeries.length ? Math.max(...latencySeries) : currentLatency;
  const latencyAvg = average(latencySeries);
  const latencyP95 = percentile(latencySeries, 95);
  const rpmAvg = average(rpmSeries);
  const rpmPeak = rpmSeries.length ? Math.max(...rpmSeries) : currentRpm;
  const uptimeMin = uptimeSeries.length ? Math.min(...uptimeSeries) : currentUptime;
  const uptimeAvg = average(uptimeSeries);
  const latencySpread = latencyMax - latencyMin;
  const availabilityUptimeSeries = availabilityPoints.map((point: any) => Number(point.uptime_percent || 0)).filter((value: number) => Number.isFinite(value));
  const availabilityCurrentUptime = availabilityUptimeSeries.length
    ? availabilityUptimeSeries[availabilityUptimeSeries.length - 1]
    : currentUptime;
  const availabilityAverageUptime = average(availabilityUptimeSeries);
  const availabilityLowestUptime = availabilityUptimeSeries.length
    ? Math.min(...availabilityUptimeSeries)
    : currentUptime;
  const openStatusVariant = mapStatusForOpenStatus(status, availabilityCurrentUptime);
  const statusBarData = buildStatusBarData(availabilityPoints, 24 * 30);
  const availabilitySummary =
    availabilityCurrentUptime >= 99.95
      ? "Operational across the last 30 days"
      : availabilityCurrentUptime >= 99
        ? "Minor degradation detected across the last 30 days"
        : "Noticeable availability issues across the last 30 days";

  const metricCards = [
    { label: "Current latency", value: formatMs(currentLatency), tone: status === "critical" ? "text-critical" : status === "warning" ? "text-warning" : "text-foreground" },
    { label: "P95 latency", value: formatMs(latencyP95), tone: "text-foreground" },
    { label: "Traffic", value: formatRpm(currentRpm), tone: "text-foreground" },
    { label: "Availability", value: formatPercent(currentUptime), tone: currentUptime < 99 ? "text-warning" : "text-foreground" },
    { label: "Latency spread", value: formatMs(latencySpread), tone: latencySpread > 150 ? "text-warning" : "text-foreground" },
    { label: "Endpoints", value: `${service.endpoints_count || 0}`, tone: "text-foreground" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border bg-card p-0 sm:max-w-[min(94vw,96rem)]">
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-4 py-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Telemetry window</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {chartData.length} sample{chartData.length === 1 ? "" : "s"}
                {latestPointTime ? ` • latest ${latestPointTime}` : ""}
              </div>
            </div>
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
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {metricCards.map((card) => (
              <DetailStatCard key={card.label} label={card.label} value={card.value} tone={card.tone} className="bg-background/60" />
            ))}
          </div>

          <DetailPanelSection
            title="Latency analysis"
            icon={<Gauge className="h-4 w-4" />}
            className="bg-background/50"
          >
            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <MetricTrendChart
                title="Latency trend"
                subtitle={trendDirection === "flat" ? "No major movement across the selected range." : `${latencyDelta > 0 ? "+" : "-"}${formatMs(latencyDeltaAbs)} vs earliest sample`}
                data={chartData}
                dataKey="latency"
                color={status === "critical" ? "hsl(0 84% 60%)" : status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                formatValue={formatMs}
                height={280}
                domain={[0, "dataMax + 25"]}
              />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <TrendIcon className={`h-4 w-4 ${trendTone}`} />
                    Recent direction
                  </div>
                  <div className={`mt-3 text-2xl font-semibold ${trendTone}`}>{trendLabel}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {trendDirection === "flat" ? "The service is holding roughly steady." : `${latencyDelta > 0 ? "Increased" : "Dropped"} by ${formatMs(latencyDeltaAbs)} over this window.`}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Observed range</div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">{formatMs(latencyMin)}–{formatMs(latencyMax)}</div>
                  <div className="mt-2 text-sm text-muted-foreground">Average {formatMs(latencyAvg)} • P95 {formatMs(latencyP95)}</div>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Volatility</div>
                  <div className="mt-3 text-2xl font-semibold text-foreground">{formatMs(latencySpread)}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {latencySpread > 150 ? "Big swings — worth checking saturation or downstream slowness." : latencySpread > 60 ? "Noticeable variance, but not chaos." : "Pretty tight latency band."}
                  </div>
                </div>
              </div>
            </div>
          </DetailPanelSection>

          <div className="grid gap-6 xl:grid-cols-2">
            <DetailPanelSection title="Traffic trend" icon={<Network className="h-4 w-4" />} className="bg-background/50">
              <div className="space-y-4">
                <MetricTrendChart
                  title="Requests per minute"
                  subtitle={`Current ${formatRpm(currentRpm)} • average ${formatRpm(rpmAvg)} • peak ${formatRpm(rpmPeak)}`}
                  data={chartData}
                  dataKey="rpm"
                  color="hsl(199 87% 49%)"
                  formatValue={formatRpm}
                  height={240}
                  domain={[0, "dataMax + 50"]}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailStatCard label="Current" value={formatRpm(currentRpm)} className="bg-background/60" />
                  <DetailStatCard label="Average" value={formatRpm(rpmAvg)} className="bg-background/60" />
                  <DetailStatCard label="Peak" value={formatRpm(rpmPeak)} className="bg-background/60" />
                </div>
              </div>
            </DetailPanelSection>

            <DetailPanelSection title="Availability trend" icon={<Activity className="h-4 w-4" />} className="bg-background/50">
              <div className="space-y-4">
                <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                  <StatusBanner status={openStatusVariant} />
                  <StatusComponent variant={openStatusVariant} className="rounded-lg border border-border/70 bg-background/60 p-3">
                    <StatusComponentHeader className="gap-3">
                      <StatusComponentHeaderLeft className="min-w-0 flex-1">
                        <div className="min-w-0">
                          <StatusComponentTitle className="truncate">Availability overview</StatusComponentTitle>
                          <div className="mt-1 text-sm text-muted-foreground">{availabilitySummary}</div>
                        </div>
                      </StatusComponentHeaderLeft>
                      <StatusComponentHeaderRight className="shrink-0">
                        <StatusComponentUptime>{formatPercent(availabilityCurrentUptime, 2)}</StatusComponentUptime>
                        <StatusComponentStatus />
                      </StatusComponentHeaderRight>
                    </StatusComponentHeader>
                    <StatusComponentBody>
                      {statusBarData.length > 0 ? <StatusBar data={statusBarData} /> : <div className="rounded-lg border border-dashed border-border/70 px-3 py-5 text-sm text-muted-foreground">No uptime history yet for the last 30 days.</div>}
                      <StatusComponentFooter data={statusBarData} />
                    </StatusComponentBody>
                  </StatusComponent>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <DetailStatCard label="Current" value={formatPercent(availabilityCurrentUptime)} className="bg-background/60" />
                  <DetailStatCard label="Average" value={formatPercent(availabilityAverageUptime)} className="bg-background/60" />
                  <DetailStatCard label="Lowest" value={formatPercent(availabilityLowestUptime)} className="bg-background/60" />
                </div>
              </div>
            </DetailPanelSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <DetailPanelSection title="Connectivity" icon={<Network className="h-4 w-4" />} className="bg-background/50" contentClassName="pt-1 sm:pt-2">
              <DetailRow label="Endpoint" value={service.endpoint} mono />
              <DetailRow label="URL" value={service.url} mono />
              <DetailRow label="Host / node" value={host?.name || "Unassigned"} />
              <DetailRow label="Host IP" value={host?.ip_address} mono />
              <DetailRow label="Host status" value={host?.status} />
              <DetailRow label="Host type" value={host?.type} />
              <DetailRow label="Created" value={service.created_at ? new Date(service.created_at).toLocaleString() : "—"} />
              <DetailRow label="Last updated" value={service.updated_at ? new Date(service.updated_at).toLocaleString() : "—"} />
            </DetailPanelSection>

            <DetailPanelSection title="Plugin details" icon={<ShieldAlert className="h-4 w-4" />} className="bg-background/50" contentClassName="pt-1 sm:pt-2">
              {detailRows.map((row) => (
                <DetailRow key={row.label} label={row.label} value={typeof row.value === "number" && String(row.label).toLowerCase().includes("byte") ? formatBytes(row.value) : row.value} />
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
