import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import { PageHeader } from "@/components/PageHeader";
import { HostDetailModal } from "@/components/HostDetailModal";
import { SectionCard } from "@/components/SectionCard";
import { Server, Bell, AlertTriangle, Zap, CheckCircle, Clock, ArrowUpRight, ArrowDownRight, Activity, ArrowUp, ArrowDown, Boxes, Container, Network } from "lucide-react";
import { motion } from "framer-motion";
import { useHostsStream } from "@/hooks/useHostStream";
import { getWorkspaceId } from "@/lib/workspace";
import { sortHosts, type HostSortKey } from "@/lib/hostSorting";
import { usePersistentHostSort } from "@/hooks/usePersistentHostSort";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

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
  const primaryK8sClusterId = k8sClusters[0]?.id;
  const primarySwarmClusterId = swarmClusters[0]?.id;
  const primaryProxmoxClusterId = proxmoxClusters[0]?.id;
  const { data: k8sStats } = useQuery({ queryKey: ["overview-k8s-stats", primaryK8sClusterId], queryFn: () => api.getK8sClusterStats(primaryK8sClusterId), enabled: !!primaryK8sClusterId, refetchInterval: 30000 });
  const { data: swarmStats } = useQuery({ queryKey: ["overview-swarm-stats", primarySwarmClusterId], queryFn: () => api.getSwarmClusterStats(primarySwarmClusterId), enabled: !!primarySwarmClusterId, refetchInterval: 30000 });
  const { data: proxmoxStats } = useQuery({ queryKey: ["overview-proxmox-stats", primaryProxmoxClusterId], queryFn: () => api.getProxmoxClusterStats(primaryProxmoxClusterId), enabled: !!primaryProxmoxClusterId, refetchInterval: 30000 });

  const liveAgentCount = useMemo(() => hosts.filter((h: any) => h.is_agent_connected).length, [hosts]);
  const sortedHosts = useMemo(
    () => sortHosts(hosts, hostSortKey, hostSortDirection),
    [hosts, hostSortKey, hostSortDirection],
  );
  const kubernetesConfigured = k8sClusters.length > 0;
  const swarmConfigured = swarmClusters.length > 0;
  const proxmoxConfigured = proxmoxClusters.length > 0;
  const kubeNodeCount = Object.values(k8sStats?.nodes_by_status || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
  const kubeWorkloadCount = (k8sStats?.deployment_count || 0) + (k8sStats?.statefulset_count || 0) + (k8sStats?.daemonset_count || 0);
  const swarmNodeCount = Object.values(swarmStats?.nodes_by_status || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
  const swarmTaskCount = Object.values(swarmStats?.tasks_by_state || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
  const proxmoxNodeCount = Object.values(proxmoxStats?.nodes_by_status || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
  const proxmoxVmCount = Object.values(proxmoxStats?.vms_by_status || {}).reduce((sum: number, value: any) => sum + Number(value || 0), 0);

  return (
    <motion.div className="space-y-6 p-4 sm:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Overview" description="System health at a glance">
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
        <motion.div variants={item} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {kubernetesConfigured && (
            <SectionCard
              title="Kubernetes"
              description={`${k8sClusters.length} cluster${k8sClusters.length === 1 ? "" : "s"} configured`}
              icon={<Boxes className="h-4 w-4" />}
              contentClassName="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3"
            >
              <MetricCard label="Nodes" value={kubeNodeCount} icon={<Server className="h-4 w-4" />} className="p-4" />
              <MetricCard label="Workloads" value={kubeWorkloadCount} icon={<Boxes className="h-4 w-4" />} className="p-4" />
              <MetricCard label="Services" value={k8sStats?.service_count ?? 0} icon={<Network className="h-4 w-4" />} className="p-4" />
            </SectionCard>
          )}
          {swarmConfigured && (
            <SectionCard
              title="Docker Swarm"
              description={`${swarmClusters.length} cluster${swarmClusters.length === 1 ? "" : "s"} configured`}
              icon={<Container className="h-4 w-4" />}
              contentClassName="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3"
            >
              <MetricCard label="Nodes" value={swarmNodeCount} icon={<Server className="h-4 w-4" />} className="p-4" />
              <MetricCard label="Tasks" value={swarmTaskCount} icon={<Container className="h-4 w-4" />} className="p-4" />
              <MetricCard label="Networks" value={swarmStats?.network_count ?? 0} icon={<Network className="h-4 w-4" />} className="p-4" />
            </SectionCard>
          )}
          {proxmoxConfigured && (
            <SectionCard
              title="Proxmox"
              description={`${proxmoxClusters.length} cluster${proxmoxClusters.length === 1 ? "" : "s"} configured`}
              icon={<Server className="h-4 w-4" />}
              contentClassName="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3"
            >
              <MetricCard label="Nodes" value={proxmoxNodeCount} icon={<Server className="h-4 w-4" />} className="p-4" />
              <MetricCard label="VMs" value={proxmoxVmCount} icon={<Boxes className="h-4 w-4" />} className="p-4" />
              <MetricCard label="Failed tasks" value={(proxmoxStats?.recent_failed_tasks || []).length} icon={<AlertTriangle className="h-4 w-4" />} className="p-4" />
            </SectionCard>
          )}
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
