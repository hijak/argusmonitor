import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { X, Server, Database, Container, Wifi, Activity, Clock3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const typeIcons: Record<string, typeof Server> = {
  server: Server, database: Database, container: Container, network: Wifi,
};

interface HostDetailModalProps {
  hostId: string | null;
  onClose: () => void;
}

export function HostDetailModal({ hostId, onClose }: HostDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["host-metrics", hostId],
    queryFn: () => api.getHostMetrics(hostId!),
    enabled: !!hostId,
    refetchInterval: 30000,
  });

  return (
    <AnimatePresence>
      {hostId && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-border bg-card shadow-2xl overflow-y-auto"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {isLoading || !data ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Loading host data...</div>
            ) : (
              <HostContent data={data} onClose={onClose} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function HostContent({ data, onClose }: { data: any; onClose: () => void }) {
  const host = data.host;
  const Icon = typeIcons[host.type] || Server;

  const cpuVals = data.cpu.map((d: any) => d.value);
  const memVals = data.memory.map((d: any) => d.value);
  const diskVals = data.disk.map((d: any) => d.value);

  const calcStats = (vals: number[]) => vals.length === 0 ? null : ({
    current: vals[vals.length - 1],
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  });

  const cpuStats = calcStats(cpuVals);
  const memStats = calcStats(memVals);

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold font-mono flex items-center gap-3">
              {host.name}
              <StatusBadge variant={host.status}>{host.status}</StatusBadge>
              {host.is_agent_connected && (
                <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                  <Activity className="h-3 w-3" /> Live agent
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">{host.ip_address || "No IP"} · {host.os || "Unknown OS"}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4 md:col-span-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Source: {host.data_source === "agent" ? "Live agent" : "Seed/demo data"}</span>
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Last seen: {host.last_seen ? new Date(host.last_seen).toLocaleString() : "N/A"}</span>
            </div>
          </div>

          <GaugeCard label="CPU" value={host.cpu_percent} />
          <GaugeCard label="CPU" value={host.cpu_percent} />
          <GaugeCard label="Memory" value={host.memory_percent} />
          <GaugeCard label="Disk" value={host.disk_percent} />
        </div>

        {/* CPU chart */}
        {data.cpu.length > 0 && (
          <MetricChart title="CPU Usage" data={data.cpu} color="hsl(25, 95%, 53%)" stats={cpuStats} unit="%" />
        )}

        {/* Memory chart */}
        {data.memory.length > 0 && (
          <MetricChart title="Memory Usage" data={data.memory} color="hsl(199, 87%, 49%)" stats={memStats} unit="%" />
        )}

        {/* Disk chart */}
        {data.disk.length > 0 && (
          <MetricChart title="Disk Usage" data={data.disk} color="hsl(160, 84%, 39%)" stats={calcStats(diskVals)} unit="%" />
        )}

        {/* Details */}
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-medium">Host Details</h3></div>
          <div className="divide-y divide-border/50">
            {[
              ["Type", host.type],
              ["IP Address", host.ip_address],
              ["Operating System", host.os],
              ["Uptime", host.uptime],
              ["Data Source", host.data_source === "agent" ? "Live agent" : "Seed/demo"],
              ["Agent Version", host.agent_version],
              ["Last Seen", host.last_seen ? new Date(host.last_seen).toLocaleString() : "N/A"],
              ["Tags", (host.tags || []).join(", ") || "None"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono text-right max-w-[60%] truncate">{v || "N/A"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function GaugeCard({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value);
  const color = pct > 80 ? "text-critical" : pct > 60 ? "text-warning" : "text-success";
  const bg = pct > 80 ? "bg-critical/10 border-critical/20" : pct > 60 ? "bg-warning/10 border-warning/20" : "bg-success/10 border-success/20";
  const barColor = pct > 80 ? "bg-critical" : pct > 60 ? "bg-warning" : "bg-success";

  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${color}`}>{pct}%</p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function MetricChart({ title, data, color, stats, unit }: {
  title: string; data: { time: string; value: number }[]; color: string;
  stats: { current: number; min: number; max: number; avg: number } | null;
  unit: string;
}) {
  const gradientId = `grad-${title.replace(/\s/g, "")}`;
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {stats && (
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span>Min: <span className="font-mono text-foreground">{stats.min.toFixed(1)}{unit}</span></span>
            <span>Avg: <span className="font-mono text-foreground">{stats.avg.toFixed(1)}{unit}</span></span>
            <span>Max: <span className="font-mono text-foreground">{stats.max.toFixed(1)}{unit}</span></span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(20, 6%, 20%)" />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} width={35} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: "hsl(20, 8%, 15%)", border: "1px solid hsl(20, 6%, 25%)", borderRadius: 8, fontSize: 12 }} />
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
