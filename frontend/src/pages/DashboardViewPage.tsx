import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ChevronLeft, RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  healthy: "hsl(160, 84%, 39%)",
  warning: "hsl(38, 92%, 50%)",
  critical: "hsl(0, 72%, 51%)",
  unknown: "hsl(25, 4%, 64%)",
  up: "hsl(160, 84%, 39%)",
  down: "hsl(0, 72%, 51%)",
};

const CHART_PALETTE = [
  "hsl(25, 95%, 53%)", "hsl(199, 87%, 49%)", "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)", "hsl(280, 65%, 60%)", "hsl(0, 72%, 51%)",
  "hsl(170, 60%, 50%)", "hsl(220, 70%, 55%)", "hsl(45, 90%, 50%)",
  "hsl(320, 60%, 55%)",
];

const PIE_COLORS: Record<string, string> = {
  healthy: "hsl(160, 84%, 39%)",
  warning: "hsl(38, 92%, 50%)",
  critical: "hsl(0, 72%, 51%)",
  unknown: "hsl(25, 4%, 64%)",
};

function GlowDefs({ id, color }: { id: string; color: string }) {
  return (
    <filter id={id} x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feFlood floodColor={color} floodOpacity="0.2" result="flood" />
      <feComposite in="flood" in2="blur" operator="in" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

interface NodeData {
  id: string;
  name: string;
  status?: string;
  type?: string;
  current?: number;
  label?: string;
  value?: number;
  data?: { time: string; value: number }[];
  [key: string]: any;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function DashboardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<{ node: NodeData; widgetTitle: string } | null>(null);

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard", id],
    queryFn: () => api.getDashboard(id!),
    enabled: !!id,
  });

  const { data: widgets = [], isLoading, refetch } = useQuery({
    queryKey: ["dashboard-widgets", id],
    queryFn: () => api.getDashboardWidgets(id!),
    enabled: !!id,
    refetchInterval: 60000,
  });

  const handleNodeClick = (node: NodeData, widgetTitle: string) => {
    setSelectedNode({ node, widgetTitle });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/dashboards")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Dashboards
        </button>
        <div className="flex-1">
          <PageHeader
            title={dashboard?.name || "Dashboard"}
            description={`${widgets.length} widgets · Live data`}
          >
            <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface-hover">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </PageHeader>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading widgets...</div>
      ) : (
        <motion.div className="grid gap-4 grid-cols-1 lg:grid-cols-2" variants={container} initial="hidden" animate="show">
          {widgets.map((widget: any) => (
            <motion.div
              key={widget.id}
              variants={item}
              className={`${
                widget.size === "full" || widget.size === "large" ? "lg:col-span-2" :
                widget.size === "small" ? "lg:col-span-1" : "lg:col-span-1"
              }`}
            >
              <WidgetRenderer widget={widget} onNodeClick={handleNodeClick} />
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedNode && (
          <NodeDetailModal
            node={selectedNode.node}
            widgetTitle={selectedNode.widgetTitle}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// =================== WIDGET RENDERER ===================
function WidgetRenderer({ widget, onNodeClick }: { widget: any; onNodeClick: (node: NodeData, title: string) => void }) {
  switch (widget.type) {
    case "line_chart":
      return <ChartWidget widget={widget} chartType="line" onNodeClick={onNodeClick} />;
    case "area_chart":
      return <ChartWidget widget={widget} chartType="area" onNodeClick={onNodeClick} />;
    case "bar_chart":
      return <BarChartWidget widget={widget} onNodeClick={onNodeClick} />;
    case "pie_chart":
      return <PieChartWidget widget={widget} />;
    case "gauge_grid":
      return <GaugeGridWidget widget={widget} onNodeClick={onNodeClick} />;
    case "stat_row":
      return <StatRowWidget widget={widget} />;
    case "table":
      return <TableWidget widget={widget} onNodeClick={onNodeClick} />;
    default:
      return <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">Unknown widget: {widget.type}</div>;
  }
}

// =================== LINE / AREA CHART ===================
function ChartWidget({ widget, chartType, onNodeClick }: { widget: any; chartType: "line" | "area"; onNodeClick: (n: NodeData, t: string) => void }) {
  const nodes: NodeData[] = widget.nodes || [];
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const chartData = useMemo(() => {
    if (nodes.length === 0) return [];
    const timePoints = nodes[0]?.data?.map((d: any) => d.time) || [];
    return timePoints.map((time: string, i: number) => {
      const point: any = { time };
      nodes.forEach((n) => {
        if (n.data?.[i]) point[n.name] = n.data[i].value;
      });
      return point;
    });
  }, [nodes]);

  const Chart = chartType === "area" ? AreaChart : LineChart;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{widget.title}</h3>
        <span className="text-xs text-muted-foreground">{nodes.length} series</span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={240}>
          <Chart data={chartData}>
            <CartesianGrid vertical={false} stroke="hsl(20 6% 20% / 0.45)" />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ background: "hsl(20, 8%, 15%)", border: "1px solid hsl(20, 6%, 25%)", borderRadius: 10, fontSize: 12, boxShadow: "0 0 24px rgba(0,0,0,0.35)" }} cursor={{ stroke: "hsl(25 4% 64% / 0.25)" }} />
            <defs>
              {nodes.map((n, i) => {
                const color = CHART_PALETTE[i % CHART_PALETTE.length];
                return <GlowDefs key={n.id} id={`glow-${widget.id}-${n.id}`} color={color} />;
              })}
            </defs>
            {nodes.map((n, i) => {
              if (hiddenSeries.has(n.name)) return null;
              const color = CHART_PALETTE[i % CHART_PALETTE.length];
              return chartType === "area" ? (
                <Area key={n.id} type="bump" dataKey={n.name} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2.5} dot={false} filter={`url(#glow-${widget.id}-${n.id})`} />
              ) : (
                <Line key={n.id} type="bump" dataKey={n.name} stroke={color} strokeWidth={2.5} dot={false} filter={`url(#glow-${widget.id}-${n.id})`} />
              );
            })}
          </Chart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-2">
          {nodes.map((n, i) => (
            <button
              key={n.id}
              onClick={() => onNodeClick(n, widget.title)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface-hover ${
                hiddenSeries.has(n.name) ? "opacity-40" : ""
              }`}
              onContextMenu={(e) => { e.preventDefault(); setHiddenSeries(s => { const ns = new Set(s); ns.has(n.name) ? ns.delete(n.name) : ns.add(n.name); return ns; }); }}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
              <span className="text-muted-foreground">{n.name}</span>
              {n.current !== undefined && <span className="font-mono text-foreground">{n.current}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =================== BAR CHART ===================
function BarChartWidget({ widget, onNodeClick }: { widget: any; onNodeClick: (n: NodeData, t: string) => void }) {
  const nodes: NodeData[] = widget.nodes || [];
  const barData = nodes.map((n) => ({ name: n.name, value: n.current ?? 0, id: n.id, status: n.status }));

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-medium">{widget.title}</h3></div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData}>
            <defs>
              {barData.map((entry, i) => {
                const color = STATUS_COLORS[entry.status || "unknown"] || CHART_PALETTE[i % CHART_PALETTE.length];
                return <GlowDefs key={entry.id || i} id={`bar-glow-${widget.id}-${i}`} color={color} />;
              })}
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(20 6% 20% / 0.45)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} width={35} />
            <Tooltip contentStyle={{ background: "hsl(20, 8%, 15%)", border: "1px solid hsl(20, 6%, 25%)", borderRadius: 10, fontSize: 12, boxShadow: "0 0 24px rgba(0,0,0,0.35)" }} cursor={{ fill: "hsl(25 4% 64% / 0.08)" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} cursor="pointer" onClick={(_: any, idx: number) => onNodeClick(nodes[idx], widget.title)}>
              {barData.map((entry, i) => {
                const color = STATUS_COLORS[entry.status || "unknown"] || CHART_PALETTE[i % CHART_PALETTE.length];
                return <Cell key={i} fill={color} filter={`url(#bar-glow-${widget.id}-${i})`} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =================== PIE CHART ===================
function PieChartWidget({ widget }: { widget: any }) {
  const data = widget.data || [];
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-medium">{widget.title}</h3></div>
      <div className="p-4 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <defs>
              {data.map((entry: any, i: number) => {
                const color = PIE_COLORS[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length];
                return <GlowDefs key={entry.name || i} id={`pie-glow-${widget.id}-${i}`} color={color} />;
              })}
            </defs>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2} label={({ name, value }) => `${name}: ${value}`}>
              {data.map((entry: any, i: number) => {
                const color = PIE_COLORS[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length];
                return <Cell key={i} fill={color} filter={`url(#pie-glow-${widget.id}-${i})`} />;
              })}
            </Pie>
            <Tooltip contentStyle={{ background: "hsl(20, 8%, 15%)", border: "1px solid hsl(20, 6%, 25%)", borderRadius: 10, fontSize: 12, boxShadow: "0 0 24px rgba(0,0,0,0.35)" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =================== GAUGE GRID ===================
function GaugeGridWidget({ widget, onNodeClick }: { widget: any; onNodeClick: (n: NodeData, t: string) => void }) {
  const nodes: NodeData[] = widget.nodes || [];
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-medium">{widget.title}</h3></div>
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {nodes.map((n) => {
          const val = n.value ?? n.current ?? 0;
          const color = n.status === "critical" ? "text-critical" : n.status === "warning" ? "text-warning" : "text-success";
          const bg = n.status === "critical" ? "bg-critical/10 border-critical/20" : n.status === "warning" ? "bg-warning/10 border-warning/20" : "bg-success/10 border-success/20";
          return (
            <button
              key={n.id}
              onClick={() => onNodeClick(n, widget.title)}
              className={`rounded-lg border p-3 text-center transition-all hover:scale-[1.03] hover:shadow-md cursor-pointer ${bg}`}
            >
              <p className={`text-xl font-bold font-mono ${color}`}>{typeof val === "number" ? (val > 10 ? Math.round(val) : val) : val}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{n.name}</p>
              {n.label && <p className="text-[9px] text-muted-foreground/60">{n.label}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =================== STAT ROW ===================
function StatRowWidget({ widget }: { widget: any }) {
  const stats = widget.stats || [];
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-3"><h3 className="text-sm font-medium">{widget.title}</h3></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
        {stats.map((s: any, i: number) => (
          <div key={i} className="px-5 py-4 text-center">
            <p className="text-2xl font-bold font-mono">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// =================== TABLE ===================
function TableWidget({ widget, onNodeClick }: { widget: any; onNodeClick: (n: NodeData, t: string) => void }) {
  const rows: any[] = widget.rows || [];
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]).filter(k => k !== "id" && k !== "tags");

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-5 py-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{widget.title}</h3>
        <span className="text-xs text-muted-foreground">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th key={col} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground capitalize">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row: any) => (
              <tr
                key={row.id || row.name}
                onClick={() => onNodeClick({ id: row.id, name: row.name, status: row.status, ...row }, widget.title)}
                className="hover:bg-surface-hover cursor-pointer transition-colors"
              >
                {columns.map(col => (
                  <td key={col} className="px-4 py-2.5 text-sm">
                    {col === "status" ? (
                      <StatusBadge variant={row[col] === "healthy" ? "healthy" : row[col] === "warning" ? "warning" : row[col] === "critical" ? "critical" : "unknown"}>
                        {row[col]}
                      </StatusBadge>
                    ) : col === "name" ? (
                      <span className="font-mono font-medium">{row[col]}</span>
                    ) : typeof row[col] === "number" ? (
                      <span className="font-mono">{row[col]}</span>
                    ) : (
                      <span>{String(row[col] ?? "")}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =================== NODE DETAIL MODAL ===================
function NodeDetailModal({ node, widgetTitle, onClose }: { node: NodeData; widgetTitle: string; onClose: () => void }) {
  const data = node.data || [];
  const hasTimeSeries = data.length > 0;

  const stats = useMemo(() => {
    if (!hasTimeSeries) return null;
    const values = data.map((d: any) => d.value);
    return {
      current: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
    };
  }, [data, hasTimeSeries]);

  const allProps = Object.entries(node).filter(
    ([k]) => !["id", "data", "name", "status", "current", "label", "value"].includes(k)
  );

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-border bg-card shadow-2xl overflow-y-auto"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div>
            <p className="text-xs text-muted-foreground">{widgetTitle}</p>
            <h2 className="text-lg font-semibold flex items-center gap-3">
              {node.name}
              {node.status && (
                <StatusBadge variant={node.status === "healthy" || node.status === "up" ? "healthy" : node.status === "warning" ? "warning" : node.status === "critical" || node.status === "down" ? "critical" : "unknown"}>
                  {node.status}
                </StatusBadge>
              )}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Stats summary */}
          {stats && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Current", value: typeof stats.current === "number" ? (stats.current > 10 ? Math.round(stats.current) : stats.current.toFixed(2)) : stats.current },
                { label: "Min", value: typeof stats.min === "number" ? (stats.min > 10 ? Math.round(stats.min) : stats.min.toFixed(2)) : stats.min },
                { label: "Max", value: typeof stats.max === "number" ? (stats.max > 10 ? Math.round(stats.max) : stats.max.toFixed(2)) : stats.max },
                { label: "Avg", value: typeof stats.avg === "number" ? (stats.avg > 10 ? Math.round(stats.avg) : stats.avg.toFixed(2)) : stats.avg },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-lg font-bold font-mono">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Time series chart */}
          {hasTimeSeries && (
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium mb-3">Trend (24h)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="nodeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0} />
                    </linearGradient>
                    <GlowDefs id="nodeTrendGlow" color="hsl(25, 95%, 53%)" />
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(20 6% 20% / 0.45)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(25, 4%, 64%)" }} tickLine={false} axisLine={false} width={45} />
                  <Tooltip contentStyle={{ background: "hsl(20, 8%, 15%)", border: "1px solid hsl(20, 6%, 25%)", borderRadius: 10, fontSize: 12, boxShadow: "0 0 24px rgba(0,0,0,0.35)" }} cursor={{ stroke: "hsl(25 4% 64% / 0.25)" }} />
                  <Area type="bump" dataKey="value" stroke="hsl(25, 95%, 53%)" fill="url(#nodeGrad)" strokeWidth={2.5} dot={false} filter="url(#nodeTrendGlow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Node properties */}
          {(allProps.length > 0 || node.current !== undefined) && (
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-medium">Details</h3>
              </div>
              <div className="divide-y divide-border/50">
                {node.current !== undefined && (
                  <div className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-muted-foreground">Current Value</span>
                    <span className="font-mono font-medium">{node.current}{node.label ? ` ${node.label}` : ""}</span>
                  </div>
                )}
                {allProps.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="font-mono text-right max-w-[60%] truncate">
                      {typeof v === "object" ? JSON.stringify(v) : String(v ?? "N/A")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
