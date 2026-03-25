import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { X, Server, Database, Container, Wifi, Activity, Clock3, HardDrive, Cpu, MemoryStick, Globe, Tags } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useHostMetricsStream } from "@/hooks/useHostStream";
import { cn } from "@/lib/utils";
import { DetailPanelSection, DetailStatCard } from "@/components/DetailPanel";
import { EmptyState, LoadingState } from "@/components/StateBlock";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const typeIcons: Record<string, typeof Server> = {
  server: Server,
  database: Database,
  container: Container,
  network: Wifi,
};

const historyRanges = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
] as const;

type HostDetailVariant = "compact" | "detailed";

interface HostDetailModalProps {
  hostId: string | null;
  onClose: () => void;
  variant?: HostDetailVariant;
}

export function HostDetailModal({ hostId, onClose, variant = "compact" }: HostDetailModalProps) {
  const [rangeHours, setRangeHours] = useState<number>(24);

  const { data: seedData, isLoading } = useQuery({
    queryKey: ["host-metrics", hostId, rangeHours],
    queryFn: () => api.getHostMetrics(hostId!, rangeHours),
    enabled: !!hostId,
  });
  const data = useHostMetricsStream(hostId, seedData, !!hostId, rangeHours);

  return (
    <AnimatePresence>
      {hostId && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-border bg-card shadow-2xl",
              variant === "detailed" ? "max-w-[min(92vw,88rem)]" : "max-w-2xl",
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {isLoading || !data ? (
              <div className="flex h-full items-center justify-center px-6">
                <LoadingState message="Loading host data..." className="w-full rounded-xl border border-border bg-card" />
              </div>
            ) : (
              <HostContent data={data} onClose={onClose} variant={variant} rangeHours={rangeHours} onRangeChange={setRangeHours} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function formatBandwidth(bytesPerSec: number) {
  if (bytesPerSec >= 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${bytesPerSec.toFixed(0)} B/s`;
}

function HostContent({
  data,
  onClose,
  variant,
  rangeHours,
  onRangeChange,
}: {
  data: any;
  onClose: () => void;
  variant: HostDetailVariant;
  rangeHours: number;
  onRangeChange: (hours: number) => void;
}) {
  const host = data.host;
  const Icon = typeIcons[host.type] || Server;
  const detailed = variant === "detailed";

  const cpuVals = data.cpu.map((d: any) => d.value);
  const memVals = data.memory.map((d: any) => d.value);
  const diskVals = data.disk.map((d: any) => d.value);
  const networkTotals = (data.network_in || []).map((entry: any, idx: number) => ({
    time: entry.time,
    value: Number(entry.value || 0) + Number(data.network_out?.[idx]?.value || 0),
  }));
  const networkVals = networkTotals.map((d: any) => d.value);

  const calcStats = (vals: number[]) =>
    vals.length === 0
      ? null
      : {
          current: vals[vals.length - 1],
          min: Math.min(...vals),
          max: Math.max(...vals),
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        };

  const cpuStats = calcStats(cpuVals);
  const memStats = calcStats(memVals);
  const diskStats = calcStats(diskVals);
  const networkStats = calcStats(networkVals);

  const telemetryCards = [
    { label: "CPU", value: host.cpu_percent, icon: Cpu },
    { label: "Memory", value: host.memory_percent, icon: MemoryStick },
    { label: "Disk", value: host.disk_percent, icon: HardDrive },
  ];

  const detailRows = useMemo(
    () => [
      { label: "Type", value: host.type },
      { label: "IP Address", value: host.ip_address || "N/A", icon: Globe },
      { label: "Operating System", value: host.os || "N/A" },
      { label: "Uptime", value: host.uptime || "N/A", icon: Clock3 },
      { label: "Data Source", value: host.data_source === "agent" ? "Live agent" : "Seed/demo" },
      { label: "Agent Version", value: host.agent_version || "N/A" },
      { label: "Last Seen", value: host.last_seen ? new Date(host.last_seen).toLocaleString() : "N/A" },
      { label: "Tags", value: (host.tags || []).join(", ") || "None", icon: Tags },
    ],
    [host.agent_version, host.data_source, host.ip_address, host.last_seen, host.os, host.tags, host.type, host.uptime],
  );

  const latestPointTime =
    data.cpu?.length || data.memory?.length || data.disk?.length || data.network_in?.length || data.network_out?.length
      ? host.last_seen
        ? new Date(host.last_seen).toLocaleString()
        : null
      : null;
  const rangeLabel = rangeHours >= 24 ? `${Math.round(rangeHours / 24)}d` : `${rangeHours}h`;

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-6 py-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("flex items-center justify-center rounded-lg bg-muted", detailed ? "h-12 w-12" : "h-10 w-10")}>
              <Icon className={cn(detailed ? "h-6 w-6" : "h-5 w-5", "text-muted-foreground")} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-mono text-lg font-semibold">{host.name}</h2>
                <StatusBadge variant={host.status}>{host.status}</StatusBadge>
                {host.is_agent_connected && (
                  <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <Activity className="h-3 w-3" /> Live agent
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {host.ip_address || "No IP"} · {host.os || "Unknown OS"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" /> Source: {host.data_source === "agent" ? "Live agent" : "Seed/demo data"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" /> Last seen: {host.last_seen ? new Date(host.last_seen).toLocaleString() : "N/A"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Telemetry range</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {latestPointTime ? `${rangeLabel} window • latest ${latestPointTime}` : `${rangeLabel} window`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {historyRanges.map((range) => (
              <button
                key={range.label}
                type="button"
                onClick={() => onRangeChange(range.hours)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${rangeHours === range.hours ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className={cn("grid gap-3", detailed ? "grid-cols-1 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-3")}>
          {telemetryCards.map(({ label, value, icon: CardIcon }) => (
            <GaugeCard key={label} label={label} value={value} icon={CardIcon} emphasis={detailed} />
          ))}
        </div>

        {detailed ? (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                {data.cpu.length > 0 && (
                  <MetricChart title="CPU Usage" data={data.cpu} color="hsl(25, 95%, 53%)" stats={cpuStats} unit="%" height={260} />
                )}
                {data.memory.length > 0 && (
                  <MetricChart title="Memory Usage" data={data.memory} color="hsl(199, 87%, 49%)" stats={memStats} unit="%" height={260} />
                )}
                {data.disk.length > 0 && (
                  <MetricChart title="Disk Usage" data={data.disk} color="hsl(160, 84%, 39%)" stats={diskStats} unit="%" height={260} />
                )}
                {(data.network_in?.length > 0 || data.network_out?.length > 0) && (
                  <BandwidthChart title="Bandwidth" networkIn={data.network_in || []} networkOut={data.network_out || []} stats={networkStats} height={260} />
                )}
              </div>

              <div className="space-y-6">
                <InfoCard title="Identity & Connectivity" rows={detailRows.slice(0, 4)} />
                <InfoCard title="Telemetry & Agent" rows={detailRows.slice(4, 7)} />
                <NetworkInterfacesCard interfaces={host.network_interfaces || []} />
                <div className="rounded-lg border border-border">
                  <div className="border-b border-border px-5 py-3">
                    <h3 className="text-sm font-medium">Tags</h3>
                  </div>
                  <div className="p-5">
                    {host.tags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {host.tags.map((tag: string) => (
                          <span key={tag} className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No tags assigned.</p>
                    )}
                  </div>
                </div>
                <TelemetrySummary cpuStats={cpuStats} memStats={memStats} diskStats={diskStats} networkStats={networkStats} />
              </div>
            </div>
          </>
        ) : (
          <>
            {data.cpu.length > 0 && (
              <MetricChart title="CPU Usage" data={data.cpu} color="hsl(25, 95%, 53%)" stats={cpuStats} unit="%" />
            )}
            {data.memory.length > 0 && (
              <MetricChart title="Memory Usage" data={data.memory} color="hsl(199, 87%, 49%)" stats={memStats} unit="%" />
            )}
            {data.disk.length > 0 && (
              <MetricChart title="Disk Usage" data={data.disk} color="hsl(160, 84%, 39%)" stats={diskStats} unit="%" />
            )}
            {(data.network_in?.length > 0 || data.network_out?.length > 0) && (
              <BandwidthChart title="Bandwidth" networkIn={data.network_in || []} networkOut={data.network_out || []} stats={networkStats} />
            )}
            <NetworkInterfacesCard interfaces={host.network_interfaces || []} />
            <InfoCard title="Host Details" rows={detailRows} compact />
          </>
        )}
      </div>
    </>
  );
}

function GaugeCard({
  label,
  value,
  icon: Icon,
  emphasis = false,
}: {
  label: string;
  value: number;
  icon: typeof Cpu;
  emphasis?: boolean;
}) {
  const pct = Math.round(value ?? 0);
  const color = pct > 80 ? "text-critical" : pct > 60 ? "text-warning" : "text-success";
  const bg = pct > 80 ? "bg-critical/10 border-critical/20" : pct > 60 ? "bg-warning/10 border-warning/20" : "bg-success/10 border-success/20";
  const barColor = pct > 80 ? "bg-critical" : pct > 60 ? "bg-warning" : "bg-success";

  return (
    <DetailStatCard
      label={label}
      value={
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="sr-only">{label}</span>
            <span />
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn("font-mono font-bold", color, emphasis ? "text-3xl" : "text-2xl")}>{pct}%</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/50">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </>
      }
      className={cn(bg, emphasis && "min-h-[132px]")}
    />
  );
}

function InfoCard({
  title,
  rows,
  compact = false,
}: {
  title: string;
  rows: { label: string; value: string; icon?: typeof Globe }[];
  compact?: boolean;
}) {
  return (
    <DetailPanelSection title={title} contentClassName="p-0">
      <div className="divide-y divide-border/50">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className={cn("flex items-center justify-between gap-4 px-5 text-sm", compact ? "py-2.5" : "py-3")}>
              <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
                <span>{row.label}</span>
              </span>
              <span className="max-w-[60%] text-right font-mono text-xs sm:text-sm">{row.value}</span>
            </div>
          );
        })}
      </div>
    </DetailPanelSection>
  );
}

function NetworkInterfacesCard({ interfaces }: { interfaces: Array<{ name: string; rx_bytes_per_sec: number; tx_bytes_per_sec: number; is_up: boolean; speed_mbps?: number | null; ipv4?: string | null }> }) {
  const top = [...interfaces].sort((a, b) => (b.rx_bytes_per_sec + b.tx_bytes_per_sec) - (a.rx_bytes_per_sec + a.tx_bytes_per_sec)).slice(0, 6);

  return (
    <DetailPanelSection title="Network Interfaces" contentClassName="p-0">
      <div className="divide-y divide-border/50">
        {top.length === 0 ? (
          <EmptyState message="No interface telemetry yet." className="m-5 bg-transparent" compact />
        ) : (
          top.map((iface) => (
            <div key={iface.name} className="grid grid-cols-[1fr] gap-3 px-5 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-foreground">{iface.name}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", iface.is_up ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                    {iface.is_up ? "UP" : "DOWN"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {iface.ipv4 || "No IPv4"}{iface.speed_mbps ? ` · ${iface.speed_mbps} Mbps` : ""}
                </div>
              </div>
              <div className="text-left text-xs text-muted-foreground sm:text-right">
                <div>RX <span className="font-mono text-foreground">{formatBandwidth(iface.rx_bytes_per_sec)}</span></div>
                <div>TX <span className="font-mono text-foreground">{formatBandwidth(iface.tx_bytes_per_sec)}</span></div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50 sm:w-24">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(((iface.rx_bytes_per_sec + iface.tx_bytes_per_sec) / (1024 * 1024)) * 25, 100)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </DetailPanelSection>
  );
}

function TelemetrySummary({
  cpuStats,
  memStats,
  diskStats,
  networkStats,
}: {
  cpuStats: { current: number; min: number; max: number; avg: number } | null;
  memStats: { current: number; min: number; max: number; avg: number } | null;
  diskStats: { current: number; min: number; max: number; avg: number } | null;
  networkStats: { current: number; min: number; max: number; avg: number } | null;
}) {
  const rows = [
    { label: "CPU avg / max", value: cpuStats ? `${cpuStats.avg.toFixed(1)}% / ${cpuStats.max.toFixed(1)}%` : "N/A" },
    { label: "Memory avg / max", value: memStats ? `${memStats.avg.toFixed(1)}% / ${memStats.max.toFixed(1)}%` : "N/A" },
    { label: "Disk avg / max", value: diskStats ? `${diskStats.avg.toFixed(1)}% / ${diskStats.max.toFixed(1)}%` : "N/A" },
    { label: "Bandwidth avg / peak", value: networkStats ? `${formatBandwidth(networkStats.avg)} / ${formatBandwidth(networkStats.max)}` : "N/A" },
  ];

  return <InfoCard title="Telemetry Summary" rows={rows} />;
}

function BandwidthChart({
  title,
  networkIn,
  networkOut,
  stats,
  height = 180,
}: {
  title: string;
  networkIn: { time: string; value: number }[];
  networkOut: { time: string; value: number }[];
  stats: { current: number; min: number; max: number; avg: number } | null;
  height?: number;
}) {
  const gradientIn = `grad-${title.replace(/\s/g, "")}-in`;
  const gradientOut = `grad-${title.replace(/\s/g, "")}-out`;
  const merged = networkIn.map((entry, idx) => ({
    time: entry.time,
    rx: Number(entry.value || 0),
    tx: Number(networkOut[idx]?.value || 0),
  }));

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {stats && (
          <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            <span>
              Now: <span className="font-mono text-foreground">{formatBandwidth(stats.current)}</span>
            </span>
            <span>
              Avg: <span className="font-mono text-foreground">{formatBandwidth(stats.avg)}</span>
            </span>
            <span>
              Peak: <span className="font-mono text-foreground">{formatBandwidth(stats.max)}</span>
            </span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={merged}>
          <defs>
            <linearGradient id={gradientIn} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(199, 87%, 49%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(199, 87%, 49%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={gradientOut} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(20, 6%, 20%)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(value) => formatBandwidth(Number(value)).replace("/s", "")} tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} width={55} />
          <Tooltip
            formatter={(value: number, name: string) => [formatBandwidth(Number(value)), name === "rx" ? "RX" : "TX"]}
            contentStyle={{ background: "hsl(20, 8%, 15%)", border: "1px solid hsl(20, 6%, 25%)", borderRadius: 8, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="rx" name="rx" stroke="hsl(199, 87%, 49%)" fill={`url(#${gradientIn})`} strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="tx" name="tx" stroke="hsl(160, 84%, 39%)" fill={`url(#${gradientOut})`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricChart({
  title,
  data,
  color,
  stats,
  unit,
  height = 180,
}: {
  title: string;
  data: { time: string; value: number }[];
  color: string;
  stats: { current: number; min: number; max: number; avg: number } | null;
  unit: string;
  height?: number;
}) {
  const gradientId = `grad-${title.replace(/\s/g, "")}`;
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {stats && (
          <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
            <span>
              Now: <span className="font-mono text-foreground">{stats.current.toFixed(1)}{unit}</span>
            </span>
            <span>
              Min: <span className="font-mono text-foreground">{stats.min.toFixed(1)}{unit}</span>
            </span>
            <span>
              Avg: <span className="font-mono text-foreground">{stats.avg.toFixed(1)}{unit}</span>
            </span>
            <span>
              Max: <span className="font-mono text-foreground">{stats.max.toFixed(1)}{unit}</span>
            </span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(20, 6%, 20%)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} width={35} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: "hsl(20, 8%, 15%)", border: "1px solid hsl(20, 6%, 25%)", borderRadius: 8, fontSize: 12 }} />
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={false} filter={`url(#${gradientId}-glow)`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
