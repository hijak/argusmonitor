import { useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import { PageHeader } from "@/components/PageHeader";
import { HostDetailModal } from "@/components/HostDetailModal";
import { SectionCard } from "@/components/SectionCard";
import { Server, Bell, AlertTriangle, Zap, CheckCircle, Clock, ArrowUpRight, ArrowDownRight, Activity, ArrowUp, ArrowDown, Boxes, Container, Network, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useHostsStream } from "@/hooks/useHostStream";
import { getWorkspaceId } from "@/lib/workspace";
import { sortHosts, type HostSortKey } from "@/lib/hostSorting";
import { usePersistentHostSort } from "@/hooks/usePersistentHostSort";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

function CompactInfraButton({
  to,
  title,
  icon,
  status,
  summary,
}: {
  to: string;
  title: string;
  icon: React.ReactNode;
  status: "healthy" | "warning" | "muted";
  summary: string;
}) {
  const tone = status === "healthy"
    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
    : status === "warning"
      ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
      : "border-border bg-card text-muted-foreground";

  return (
    <Link
      to={to}
      className={`group flex min-h-[68px] items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-surface-hover ${tone}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-lg bg-black/10 p-2">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{summary}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function OverviewPage() {
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const { sortKey: hostSortKey, sortDirection: hostSortDirection, toggleSort: toggleHostSort } = usePersistentHostSort({
    storageKey: "argus-overview-host-sort",
    defaultKey: "status",
    defaultDirection: "asc",
    queryKey: "overviewHostSort",
    queryDirection: "overviewHostDir",
  });
  const { data: stats } = useQuery({ queryKey: ["overview-stats"], queryFn: api.overviewStats, refetchInterval: 30000 });
  const workspaceId = getWorkspaceId();
  const { data: hostsSeed = [] } = useQuery({ queryKey: ["overview-hosts", workspaceId], queryFn: api.overviewHostHealth });
  const hosts = useHostsStream(hostsSeed, { path: "/api/overview/host-health/stream" });
  const { data: alerts = [] } = useQuery({ queryKey: ["overview-alerts"], queryFn: api.overviewRecentAlerts, refetchInterval: 15000 });
  const { data: incidents = [] } = useQuery({ queryKey: ["overview-incidents"], queryFn: api.overviewRecentIncidents, refetchInterval: 30000 });
  const { data: transactions = [] } = useQuery({ queryKey: ["overview-tx"], queryFn: api.overviewTransactionSummary, refetchInterval: 30000 });
  const { data: k8sClusters = [] } = useQuery({ queryKey: ["k8s-clusters"], queryFn: api.listK8sClusters, refetchInterval: 30000 });
  const { data: swarmClusters = [] } = useQuery({ queryKey: ["swarm-clusters"], queryFn: api.listSwarmClusters, refetchInterval: 30000 });
  const { data: proxmoxClusters = [] } = useQuery({ queryKey: ["proxmox-clusters"], queryFn: api.listProxmoxClusters, refetchInterval: 30000 });
  const k8sStatsResults = useQueries({
    queries: k8sClusters.map((cluster: any) => ({
      queryKey: ["overview-k8s-stats", cluster.id],
      queryFn: () => api.getK8sClusterStats(cluster.id),
      enabled: !!cluster.id,
      refetchInterval: 30000,
    })),
  });
  const swarmStatsResults = useQueries({
    queries: swarmClusters.map((cluster: any) => ({
      queryKey: ["overview-swarm-stats", cluster.id],
      queryFn: () => api.getSwarmClusterStats(cluster.id),
      enabled: !!cluster.id,
      refetchInterval: 30000,
    })),
  });
  const proxmoxStatsResults = useQueries({
    queries: proxmoxClusters.map((cluster: any) => ({
      queryKey: ["overview-proxmox-stats", cluster.id],
      queryFn: () => api.getProxmoxClusterStats(cluster.id),
      enabled: !!cluster.id,
      refetchInterval: 30000,
    })),
  });

  const liveAgentCount = useMemo(() => hosts.filter((h: any) => h.is_agent_connected).length, [hosts]);
  const sortedHosts = useMemo(
    () => sortHosts(hosts, hostSortKey, hostSortDirection),
    [hosts, hostSortKey, hostSortDirection],
  );
  const kubernetesConfigured = k8sClusters.length > 0;
  const swarmConfigured = swarmClusters.length > 0;
  const proxmoxConfigured = proxmoxClusters.length > 0;
  const k8sStatsList = k8sStatsResults.map((result) => result.data).filter(Boolean) as any[];
  const swarmStatsList = swarmStatsResults.map((result) => result.data).filter(Boolean) as any[];
  const proxmoxStatsList = proxmoxStatsResults.map((result) => result.data).filter(Boolean) as any[];
  const kubeNodeCount = k8sStatsList.reduce((sum: number, stats: any) => sum + Object.values(stats?.nodes_by_status || {}).reduce((inner: number, value: any) => inner + Number(value || 0), 0), 0);
  const kubeWorkloadCount = k8sStatsList.reduce((sum: number, stats: any) => sum + Number(stats?.deployment_count || 0) + Number(stats?.statefulset_count || 0) + Number(stats?.daemonset_count || 0), 0);
  const swarmNodeCount = swarmStatsList.reduce((sum: number, stats: any) => sum + Object.values(stats?.nodes_by_status || {}).reduce((inner: number, value: any) => inner + Number(value || 0), 0), 0);
  const swarmTaskCount = swarmStatsList.reduce((sum: number, stats: any) => sum + Object.values(stats?.tasks_by_state || {}).reduce((inner: number, value: any) => inner + Number(value || 0), 0), 0);
  const proxmoxNodeCount = proxmoxStatsList.reduce((sum: number, stats: any) => sum + Object.values(stats?.nodes_by_status || {}).reduce((inner: number, value: any) => inner + Number(value || 0), 0), 0);
  const proxmoxVmCount = proxmoxStatsList.reduce((sum: number, stats: any) => sum + Object.values(stats?.vms_by_status || {}).reduce((inner: number, value: any) => inner + Number(value || 0), 0), 0);

  return (
    <motion.div className="space-y-6 p-4 sm:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Dashboard" description="System health at a glance">
          <StatusBadge variant="info" pulse>{liveAgentCount} live agents reporting</StatusBadge>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Monitored Hosts" value={stats?.monitored_hosts ?? 0} change={stats?.hosts_change} changeType="positive" icon={<Server className="h-4 w-4" />} />
        <MetricCard label="Active Alerts" value={stats?.active_alerts ?? 0} change={stats?.alerts_change} changeType="negative" icon={<Bell className="h-4 w-4" />} />
        <MetricCard label="Health Score" value={stats ? `${stats.health_score}%` : "..."} change={stats?.health_change} changeType="neutral" icon={<CheckCircle className="h-4 w-4" />} />
        <MetricCard label="Transaction Success" value={stats ? `${stats.transaction_success}%` : "..."} change={stats?.tx_change} changeType="positive" icon={<Zap className="h-4 w-4" />} />
      </motion.div>

      {(kubernetesConfigured || swarmConfigured || proxmoxConfigured) && (
        <motion.div variants={item}>
          <SectionCard
            title="Infrastructure status"
            description="Compact links into cluster views instead of three giant dashboard cards."
            icon={<Network className="h-4 w-4" />}
            contentClassName="p-4"
          >
            <div className="grid gap-3 md:grid-cols-3">
              {kubernetesConfigured && (
                <CompactInfraButton
                  to="/kubernetes?tab=workloads"
                  title="Kubernetes"
                  icon={<Boxes className="h-4 w-4" />}
                  status={kubeNodeCount > 0 ? "healthy" : "warning"}
                  summary={`${k8sClusters.length} cluster${k8sClusters.length === 1 ? "" : "s"} · ${kubeNodeCount} nodes total · ${kubeWorkloadCount} workloads total`}
                />
              )}
              {swarmConfigured && (
                <CompactInfraButton
                  to="/swarm?tab=services"
                  title="Docker Swarm"
                  icon={<Container className="h-4 w-4" />}
                  status={swarmNodeCount > 0 ? "healthy" : "warning"}
                  summary={`${swarmClusters.length} cluster${swarmClusters.length === 1 ? "" : "s"} · ${swarmNodeCount} nodes total · ${swarmTaskCount} tasks total`}
                />
              )}
              {proxmoxConfigured && (
                <CompactInfraButton
                  to="/proxmox?tab=guests"
                  title="Proxmox"
                  icon={<Server className="h-4 w-4" />}
                  status={proxmoxNodeCount > 0 ? "healthy" : "warning"}
                  summary={`${proxmoxClusters.length} cluster${proxmoxClusters.length === 1 ? "" : "s"} · ${proxmoxNodeCount} nodes total · ${proxmoxVmCount} VMs total`}
                />
              )}
            </div>
          </SectionCard>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-medium">Host Health</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{sortedHosts.length} hosts</span>
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background/60 p-1">
                  {([
                    ["status", "Status"],
                    ["cpu", "CPU"],
                    ["memory", "Memory"],
                    ["name", "Name"],
                  ] as [HostSortKey, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleHostSort(key)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${hostSortKey === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {label}
                      {hostSortKey === key && (hostSortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {sortedHosts.map((host: any) => (
                <div key={host.id} onClick={() => setSelectedHostId(host.id)} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-hover cursor-pointer">
                  <StatusBadge variant={host.status}>{host.status}</StatusBadge>
                  <div className="flex flex-1 items-center gap-2 min-w-0">
                    <span className="truncate font-mono text-sm">{host.name}</span>
                    {host.is_agent_connected && (
                      <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                        <Activity className="h-2.5 w-2.5" /> Live
                      </span>
                    )}
                  </div>
                  <div className="hidden items-center gap-6 text-xs text-muted-foreground sm:flex">
                    <span>CPU {Math.round(host.cpu_percent)}%</span>
                    <span>MEM {Math.round(host.memory_percent)}%</span>
                    <span>{host.uptime || "N/A"}</span>
                    {host.last_seen && <span>seen {new Date(host.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  <Sparkline
                    data={host.spark || []}
                    color={host.status === "critical" ? "hsl(0 84% 60%)" : host.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                    width={80}
                    height={24}
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.div variants={item}>
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-medium">Active Incidents</h2>
                <span className="text-xs text-muted-foreground">{incidents.length}</span>
              </div>
              <div className="divide-y divide-border">
                {incidents.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-muted-foreground">No active incidents</div>
                )}
                {incidents.map((inc: any) => (
                  <div key={inc.id} className="px-5 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{inc.title}</span>
                      <StatusBadge variant={inc.severity}>{inc.severity}</StatusBadge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="capitalize">{inc.status}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{inc.ref}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div variants={item}>
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-medium">Transactions</h2>
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="divide-y divide-border">
                {transactions.map((tx: any) => (
                  <div key={tx.name} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <span className="text-sm">{tx.name}</span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{tx.avgTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${tx.success >= 99 ? 'text-success' : tx.success >= 97 ? 'text-warning' : 'text-critical'}`}>
                        {tx.success}%
                      </span>
                      {tx.success >= 99 ? <ArrowUpRight className="h-3 w-3 text-success" /> : <ArrowDownRight className="h-3 w-3 text-critical" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div variants={item}>
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium">Recent Alerts</h2>
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {alerts.length === 0 && (
              <div className="px-5 py-6 text-center text-sm text-muted-foreground">No active alerts</div>
            )}
            {alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-hover">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.severity === "critical" ? "text-critical" : "text-warning"}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{alert.message}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{alert.service}</span>
                </div>
                <StatusBadge variant={alert.severity === "info" ? "info" : alert.severity === "critical" ? "critical" : "warning"}>
                  {alert.severity}
                </StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <HostDetailModal hostId={selectedHostId} variant="compact" onClose={() => setSelectedHostId(null)} />
    </motion.div>
  );
}
