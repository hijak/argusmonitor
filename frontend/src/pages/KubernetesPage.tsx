import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Plus, Server, Container, RefreshCw, ChevronDown, ChevronRight,
  Cpu, HardDrive, Box, Loader2, Trash2, AlertCircle, CheckCircle,
  Clock, XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

const podStatusColors: Record<string, string> = {
  running: "text-success",
  succeeded: "text-success",
  pending: "text-warning",
  failed: "text-critical",
  unknown: "text-muted-foreground",
};

const podStatusIcons: Record<string, typeof CheckCircle> = {
  running: CheckCircle,
  succeeded: CheckCircle,
  pending: Clock,
  failed: XCircle,
  unknown: AlertCircle,
};

export default function KubernetesPage() {
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pods" | "nodes" | "namespaces">("pods");
  const [nsFilter, setNsFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddCluster, setShowAddCluster] = useState(false);
  const [newName, setNewName] = useState("");
  const [newApiServer, setNewApiServer] = useState("");
  const [newKubeconfig, setNewKubeconfig] = useState("");
  const queryClient = useQueryClient();

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ["k8s-clusters"],
    queryFn: api.listK8sClusters,
    refetchInterval: 30000,
  });

  const selectedClusterData = clusters.find((c: any) => c.id === selectedCluster);

  const { data: pods = [] } = useQuery({
    queryKey: ["k8s-pods", selectedCluster, nsFilter, statusFilter],
    queryFn: () => api.listK8sPods(selectedCluster!, nsFilter || undefined, statusFilter || undefined),
    enabled: !!selectedCluster && activeTab === "pods",
  });

  const { data: nodes = [] } = useQuery({
    queryKey: ["k8s-nodes", selectedCluster],
    queryFn: () => api.listK8sNodes(selectedCluster!),
    enabled: !!selectedCluster && activeTab === "nodes",
  });

  const { data: namespaces = [] } = useQuery({
    queryKey: ["k8s-namespaces", selectedCluster],
    queryFn: () => api.listK8sNamespaces(selectedCluster!),
    enabled: !!selectedCluster && activeTab === "namespaces",
  });

  const createMutation = useMutation({
    mutationFn: api.createK8sCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["k8s-clusters"] });
      setShowAddCluster(false);
      setNewName("");
      setNewApiServer("");
      setNewKubeconfig("");
    },
  });

  const discoverMutation = useMutation({
    mutationFn: api.discoverK8sCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["k8s-clusters"] });
      queryClient.invalidateQueries({ queryKey: ["k8s-pods"] });
      queryClient.invalidateQueries({ queryKey: ["k8s-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["k8s-namespaces"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteK8sCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["k8s-clusters"] });
      setSelectedCluster(null);
    },
  });

  const handleCreate = () => {
    if (!newName || !newApiServer) return;
    createMutation.mutate({
      name: newName,
      api_server: newApiServer,
      auth_type: newKubeconfig ? "kubeconfig" : "token",
      auth_config: newKubeconfig ? { kubeconfig: newKubeconfig } : {},
    });
  };

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Kubernetes" description="Monitor cluster health, nodes, and workloads">
          <button
            onClick={() => setShowAddCluster(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Cluster
          </button>
        </PageHeader>
      </motion.div>

      {/* Cluster Cards */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {clusters.map((cluster: any) => (
          <div
            key={cluster.id}
            onClick={() => setSelectedCluster(cluster.id === selectedCluster ? null : cluster.id)}
            className={`cursor-pointer rounded-xl border p-5 transition-all ${
              selectedCluster === cluster.id
                ? "border-primary/50 bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/30 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
                  <Container className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{cluster.name}</h3>
                  <p className="text-xs text-muted-foreground">{cluster.version ? `v${cluster.version}` : "Unknown version"}</p>
                </div>
              </div>
              <StatusBadge variant={cluster.status}>{cluster.status}</StatusBadge>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-surface p-2.5 text-center">
                <p className="text-lg font-bold">{cluster.node_count}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nodes</p>
              </div>
              <div className="rounded-lg bg-surface p-2.5 text-center">
                <p className="text-lg font-bold">{cluster.pod_count}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pods</p>
              </div>
              <div className="rounded-lg bg-surface p-2.5 text-center">
                <p className="text-lg font-bold">{cluster.namespace_count}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Namespaces</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground"><Cpu className="inline h-3 w-3 mr-1" />CPU</span>
                  <span className="font-mono">{cluster.cpu_usage_percent}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full transition-all ${cluster.cpu_usage_percent > 80 ? "bg-critical" : cluster.cpu_usage_percent > 60 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${Math.min(cluster.cpu_usage_percent, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground"><HardDrive className="inline h-3 w-3 mr-1" />Memory</span>
                  <span className="font-mono">{cluster.memory_usage_percent}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full transition-all ${cluster.memory_usage_percent > 80 ? "bg-critical" : cluster.memory_usage_percent > 60 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${Math.min(cluster.memory_usage_percent, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {cluster.running_pods}/{cluster.pod_count} pods running
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); discoverMutation.mutate(cluster.id); }}
                  disabled={discoverMutation.isPending}
                  className="rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
                  title="Refresh discovery"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${discoverMutation.isPending ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(cluster.id); }}
                  className="rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-critical"
                  title="Remove cluster"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {clusters.length === 0 && !isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
            <Container className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">No clusters connected</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Add a Kubernetes cluster to start monitoring</p>
          </div>
        )}
      </motion.div>

      {/* Detail Section */}
      <AnimatePresence>
        {selectedCluster && selectedClusterData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card">
              {/* Tabs */}
              <div className="flex items-center gap-1 border-b border-border px-4">
                {(["pods", "nodes", "namespaces"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "pods" ? `Pods (${pods.length})` : tab === "nodes" ? `Nodes (${nodes.length})` : `Namespaces (${namespaces.length})`}
                  </button>
                ))}

                {activeTab === "pods" && (
                  <div className="ml-auto flex items-center gap-2">
                    <input
                      value={nsFilter}
                      onChange={(e) => setNsFilter(e.target.value)}
                      placeholder="Filter namespace..."
                      className="h-8 w-40 rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground outline-none"
                    >
                      <option value="">All statuses</option>
                      <option value="running">Running</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                      <option value="succeeded">Succeeded</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                {activeTab === "pods" && (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Namespace</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Ready</th>
                        <th className="px-4 py-2.5 font-medium">Restarts</th>
                        <th className="px-4 py-2.5 font-medium">Node</th>
                        <th className="px-4 py-2.5 font-medium">CPU</th>
                        <th className="px-4 py-2.5 font-medium">Memory</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pods.map((pod: any) => {
                        const StatusIcon = podStatusIcons[pod.status] || AlertCircle;
                        return (
                          <tr key={pod.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <StatusIcon className={`h-3.5 w-3.5 ${podStatusColors[pod.status]}`} />
                                <span className="font-mono text-xs">{pod.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{pod.namespace}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-medium capitalize ${podStatusColors[pod.status]}`}>{pod.status}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-mono">{pod.ready_containers}/{pod.container_count}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-xs font-mono ${pod.restart_count > 5 ? "text-critical" : pod.restart_count > 0 ? "text-warning" : ""}`}>
                                {pod.restart_count}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{pod.node_name || "-"}</td>
                            <td className="px-4 py-2.5 text-xs font-mono">{pod.cpu_usage || "-"}</td>
                            <td className="px-4 py-2.5 text-xs font-mono">{pod.memory_usage || "-"}</td>
                          </tr>
                        );
                      })}
                      {pods.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">No pods found</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === "nodes" && (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Role</th>
                        <th className="px-4 py-2.5 font-medium">Version</th>
                        <th className="px-4 py-2.5 font-medium">CPU</th>
                        <th className="px-4 py-2.5 font-medium">Memory</th>
                        <th className="px-4 py-2.5 font-medium">OS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {nodes.map((node: any) => (
                        <tr key={node.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-2.5 font-mono text-xs">{node.name}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge variant={node.status === "ready" ? "healthy" : "critical"}>{node.status}</StatusBadge>
                          </td>
                          <td className="px-4 py-2.5 text-xs">{node.role || "worker"}</td>
                          <td className="px-4 py-2.5 text-xs font-mono">{node.kubelet_version || "-"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface">
                                <div className={`h-full rounded-full ${node.cpu_usage_percent > 80 ? "bg-critical" : "bg-success"}`} style={{ width: `${Math.min(node.cpu_usage_percent, 100)}%` }} />
                              </div>
                              <span className="text-xs font-mono">{node.cpu_usage_percent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface">
                                <div className={`h-full rounded-full ${node.memory_usage_percent > 80 ? "bg-critical" : "bg-success"}`} style={{ width: `${Math.min(node.memory_usage_percent, 100)}%` }} />
                              </div>
                              <span className="text-xs font-mono">{node.memory_usage_percent}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{node.os_image || "-"}</td>
                        </tr>
                      ))}
                      {nodes.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">No nodes found</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === "namespaces" && (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Pods</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {namespaces.map((ns: any) => (
                        <tr key={ns.id} className="hover:bg-surface-hover/50">
                          <td className="px-4 py-2.5 font-mono text-xs">{ns.name}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge variant={ns.status === "Active" ? "healthy" : "warning"}>{ns.status}</StatusBadge>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono">{ns.pod_count}</td>
                        </tr>
                      ))}
                      {namespaces.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">No namespaces found</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Cluster Modal */}
      <AnimatePresence>
        {showAddCluster && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddCluster(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-lg font-semibold">Add Kubernetes Cluster</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Connect a cluster to monitor its resources</p>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Cluster Name</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. production-cluster"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">API Server URL</label>
                  <input
                    value={newApiServer}
                    onChange={e => setNewApiServer(e.target.value)}
                    placeholder="https://kubernetes.example.com:6443"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Kubeconfig (optional)</label>
                  <textarea
                    value={newKubeconfig}
                    onChange={e => setNewKubeconfig(e.target.value)}
                    rows={6}
                    placeholder="Paste your kubeconfig YAML here..."
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                <button onClick={() => setShowAddCluster(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName || !newApiServer || createMutation.isPending}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Connect Cluster
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
