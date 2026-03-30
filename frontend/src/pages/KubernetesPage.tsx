import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import {
  AlertCircle,
  ArrowUpDown,
  Box,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Container,
  Cpu,
  HardDrive,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Trash2,
  Workflow,
  Database,
  Boxes,
  ListTree,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const resourceTabs = [
  { key: "overview", label: "Overview", icon: Layers3 },
  { key: "pods", label: "Pods", icon: Container },
  { key: "deployments", label: "Deployments", icon: Box },
  { key: "statefulsets", label: "StatefulSets", icon: Database },
  { key: "daemonsets", label: "DaemonSets", icon: Boxes },
  { key: "jobs", label: "Jobs", icon: ListTree },
  { key: "services", label: "Services", icon: Workflow },
  { key: "nodes", label: "Nodes", icon: Server },
  { key: "events", label: "Events", icon: ShieldAlert },
] as const;

type ResourceTab = (typeof resourceTabs)[number]["key"];

const podStatusColors: Record<string, string> = {
  running: "text-success",
  succeeded: "text-success",
  pending: "text-warning",
  failed: "text-critical",
  completed: "text-success",
  scheduled: "text-primary",
  healthy: "text-success",
  warning: "text-warning",
  critical: "text-critical",
  unknown: "text-muted-foreground",
};

function fmtAge(date?: string) {
  if (!date) return "-";
  const then = new Date(date).getTime();
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${active ? "bg-primary/10 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-foreground">{value || "-"}</span>
    </div>
  );
}

function GroupHeaderRow({
  title,
  count,
  colSpan,
}: {
  title: string;
  count: number;
  colSpan: number;
}) {
  return (
    <tr className="bg-card/95">
      <td colSpan={colSpan} className="px-4 py-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
          <span className="text-[11px] text-muted-foreground">{count}</span>
        </div>
      </td>
    </tr>
  );
}

export default function KubernetesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTabFromUrl = (searchParams.get("tab") as ResourceTab | null) || "overview";
  const initialClusterFromUrl = searchParams.get("cluster");
  const [selectedCluster, setSelectedCluster] = useState<string | null>(initialClusterFromUrl);
  const [activeTab, setActiveTab] = useState<ResourceTab>(initialTabFromUrl);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [namespaceFilter, setNamespaceFilter] = useState<string>(() => localStorage.getItem("k8s.namespaceFilter") || "all");
  const [statusFilter, setStatusFilter] = useState<string>(() => localStorage.getItem("k8s.statusFilter") || "");
  const [search, setSearch] = useState<string>(() => localStorage.getItem("k8s.search") || "");
  const [groupByNamespace, setGroupByNamespace] = useState<boolean>(() => localStorage.getItem("k8s.groupByNamespace") === "1");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [showAddCluster, setShowAddCluster] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKubeconfig, setNewKubeconfig] = useState("");

  useEffect(() => void localStorage.setItem("k8s.namespaceFilter", namespaceFilter), [namespaceFilter]);
  useEffect(() => void localStorage.setItem("k8s.statusFilter", statusFilter), [statusFilter]);
  useEffect(() => void localStorage.setItem("k8s.search", search), [search]);
  useEffect(() => void localStorage.setItem("k8s.groupByNamespace", groupByNamespace ? "1" : "0"), [groupByNamespace]);

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ["k8s-clusters"],
    queryFn: api.listK8sClusters,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!selectedCluster && clusters.length) setSelectedCluster(clusters[0].id);
  }, [clusters, selectedCluster]);

  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", activeTab);
      if (selectedCluster) next.set("cluster", selectedCluster);
      else next.delete("cluster");
      return next;
    }, { replace: true });
  }, [activeTab, selectedCluster, setSearchParams]);

  const selectedClusterData = clusters.find((c: any) => c.id === selectedCluster) ?? null;
  const nsQuery = namespaceFilter === "all" ? undefined : namespaceFilter;

  const { data: stats } = useQuery({ queryKey: ["k8s-stats", selectedCluster], queryFn: () => api.getK8sClusterStats(selectedCluster!), enabled: !!selectedCluster, refetchInterval: 30000 });
  const { data: namespaces = [] } = useQuery({ queryKey: ["k8s-namespaces", selectedCluster], queryFn: () => api.listK8sNamespaces(selectedCluster!), enabled: !!selectedCluster });
  const { data: pods = [] } = useQuery({ queryKey: ["k8s-pods", selectedCluster, nsQuery, statusFilter], queryFn: () => api.listK8sPods(selectedCluster!, nsQuery, statusFilter || undefined), enabled: !!selectedCluster });
  const { data: deployments = [] } = useQuery({ queryKey: ["k8s-deployments", selectedCluster, nsQuery], queryFn: () => api.listK8sDeployments(selectedCluster!, nsQuery), enabled: !!selectedCluster });
  const { data: statefulsets = [] } = useQuery({ queryKey: ["k8s-statefulsets", selectedCluster, nsQuery], queryFn: () => api.listK8sStatefulSets(selectedCluster!, nsQuery), enabled: !!selectedCluster });
  const { data: daemonsets = [] } = useQuery({ queryKey: ["k8s-daemonsets", selectedCluster, nsQuery], queryFn: () => api.listK8sDaemonSets(selectedCluster!, nsQuery), enabled: !!selectedCluster });
  const { data: jobs = [] } = useQuery({ queryKey: ["k8s-jobs", selectedCluster, nsQuery], queryFn: () => api.listK8sJobs(selectedCluster!, nsQuery), enabled: !!selectedCluster });
  const { data: services = [] } = useQuery({ queryKey: ["k8s-services", selectedCluster, nsQuery], queryFn: () => api.listK8sServices(selectedCluster!, nsQuery), enabled: !!selectedCluster });
  const { data: nodes = [] } = useQuery({ queryKey: ["k8s-nodes", selectedCluster], queryFn: () => api.listK8sNodes(selectedCluster!), enabled: !!selectedCluster });
  const { data: events = [] } = useQuery({ queryKey: ["k8s-events", selectedCluster, nsQuery], queryFn: () => api.listK8sEvents(selectedCluster!, nsQuery, 100), enabled: !!selectedCluster });

  const createMutation = useMutation({
    mutationFn: api.createK8sCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["k8s-clusters"] });
      setShowAddCluster(false);
      setNewName("");
      setNewKubeconfig("");
    },
  });

  const discoverMutation = useMutation({
    mutationFn: api.discoverK8sCluster,
    onSuccess: () => {
      ["k8s-clusters", "k8s-stats", "k8s-pods", "k8s-deployments", "k8s-statefulsets", "k8s-daemonsets", "k8s-jobs", "k8s-services", "k8s-nodes", "k8s-events", "k8s-namespaces"].forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteK8sCluster,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["k8s-clusters"] });
      setSelectedCluster(null);
      setSelectedResource(null);
    },
  });

  const handleCreate = () => {
    if (!newName || !newKubeconfig.trim()) return;
    createMutation.mutate({ name: newName, auth_type: "kubeconfig", auth_config: { kubeconfig: newKubeconfig } });
  };

  const namespaceOptions = useMemo(() => ["all", ...namespaces.map((ns: any) => ns.name)], [namespaces]);

  const namespaceDashboards = useMemo(() => {
    return namespaces
      .map((ns: any) => {
        const nsPods = pods.filter((p: any) => p.namespace === ns.name);
        const nsDeployments = deployments.filter((d: any) => d.namespace === ns.name);
        const nsServices = services.filter((s: any) => s.namespace === ns.name);
        const nsWarnings = events.filter((e: any) => e.namespace === ns.name && e.type === "Warning");
        const restartTotal = nsPods.reduce((sum: number, p: any) => sum + (p.restart_count || 0), 0);
        const unhealthyDeployments = nsDeployments.filter((d: any) => d.status !== "healthy");
        return {
          name: ns.name,
          podCount: nsPods.length,
          deploymentCount: nsDeployments.length,
          serviceCount: nsServices.length,
          warningCount: nsWarnings.length,
          restartTotal,
          exposedServices: nsServices.filter((s: any) => s.external_ip || s.service_type === "LoadBalancer" || s.service_type === "NodePort"),
          unhealthyDeployments,
        };
      })
      .sort((a, b) => (b.warningCount - a.warningCount) || (b.restartTotal - a.restartTotal) || (b.podCount - a.podCount) || a.name.localeCompare(b.name));
  }, [namespaces, pods, deployments, services, events]);

  const relatedResources = useMemo(() => {
    if (!selectedResource) return null;
    const ns = selectedResource.namespace;
    const name = selectedResource.name || selectedResource.involved_name;
    const relatedPods = ns ? pods.filter((p: any) => p.namespace === ns && (!name || p.name.includes(name) || name.includes(p.name))).slice(0, 8) : [];
    const relatedDeployments = ns ? deployments.filter((d: any) => d.namespace === ns && (!name || d.name === name || name.includes(d.name) || d.name.includes(name))).slice(0, 8) : [];
    const relatedServices = ns ? services.filter((s: any) => s.namespace === ns && (!selectedResource.selector || Object.keys(selectedResource.selector).length === 0 || Object.keys(selectedResource.selector).some((key) => (selectedResource.labels || {})[key] === selectedResource.selector[key]))).slice(0, 8) : [];
    const relatedEvents = ns ? events.filter((evt: any) => evt.namespace === ns && (name ? evt.involved_name === name || evt.involved_name?.includes(name) : true)).slice(0, 8) : [];
    return { relatedPods, relatedDeployments, relatedServices, relatedEvents };
  }, [selectedResource, pods, deployments, services, events]);

  const rawItems = useMemo(() => {
    switch (activeTab) {
      case "pods": return pods;
      case "deployments": return deployments;
      case "statefulsets": return statefulsets;
      case "daemonsets": return daemonsets;
      case "jobs": return jobs;
      case "services": return services;
      case "nodes": return nodes;
      case "events": return events;
      default: return [];
    }
  }, [activeTab, pods, deployments, statefulsets, daemonsets, jobs, services, nodes, events]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawItems.filter((item: any) => {
      const hay = [
        item.name,
        item.namespace,
        item.node_name,
        item.status,
        item.type,
        item.kind,
        item.reason,
        item.message,
        item.involved_name,
        item.involved_kind,
      ].filter(Boolean).join(" ").toLowerCase();
      return !q || hay.includes(q);
    });
  }, [rawItems, search]);

  const sortedItems = useMemo(() => {
    const compareText = (left: any, right: any) => String(left || "").localeCompare(String(right || ""), undefined, { numeric: true, sensitivity: "base" });
    const compareNumber = (left: any, right: any) => Number(left || 0) - Number(right || 0);
    const sorted = [...filteredItems].sort((a: any, b: any) => {
      let result = 0;
      switch (sortKey) {
        case "namespace": result = compareText(a.namespace, b.namespace); break;
        case "status": result = compareText(a.status || a.type, b.status || b.type); break;
        case "node": result = compareText(a.node_name, b.node_name); break;
        case "ready": result = compareNumber((a.ready_containers ?? a.ready_replicas ?? a.number_ready ?? a.succeeded ?? 0), (b.ready_containers ?? b.ready_replicas ?? b.number_ready ?? b.succeeded ?? 0)); break;
        case "restarts": result = compareNumber(a.restart_count, b.restart_count); break;
        case "age": result = compareText(a.started_at || a.created_at || a.event_time || a.last_seen, b.started_at || b.created_at || b.event_time || b.last_seen); break;
        case "type": result = compareText(a.service_type || a.kind || a.type, b.service_type || b.kind || b.type); break;
        case "external": result = compareText(a.external_ip, b.external_ip); break;
        case "ports": result = compareText((a.ports || []).map((p: any) => p.port).join(","), (b.ports || []).map((p: any) => p.port).join(",")); break;
        case "role": result = compareText(a.role, b.role); break;
        case "version": result = compareText(a.kubelet_version, b.kubelet_version); break;
        case "cpu": result = compareNumber(a.cpu_usage_percent, b.cpu_usage_percent); break;
        case "memory": result = compareNumber(a.memory_usage_percent, b.memory_usage_percent); break;
        case "reason": result = compareText(a.reason, b.reason); break;
        case "object": result = compareText(`${a.involved_kind || ""} ${a.involved_name || ""}`, `${b.involved_kind || ""} ${b.involved_name || ""}`); break;
        case "name":
        default:
          result = compareText(a.name || a.involved_name, b.name || b.involved_name);
      }
      if (result === 0) result = compareText(a.name || a.involved_name, b.name || b.involved_name);
      return sortDirection === "asc" ? result : -result;
    });
    return sorted;
  }, [filteredItems, sortDirection, sortKey]);

  const groupedItems = useMemo(() => {
    if (!groupByNamespace || activeTab === "nodes" || activeTab === "overview") return null;
    const groups = new Map<string, any[]>();
    sortedItems.forEach((item: any) => {
      const key = item.namespace || "cluster";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sortedItems, groupByNamespace, activeTab]);

  const pageSize = 25;
  const pagedItems = useMemo(() => sortedItems.slice(page * pageSize, page * pageSize + pageSize), [sortedItems, page]);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));

  useEffect(() => {
    setSelectedResource(null);
  }, [activeTab, selectedCluster, namespaceFilter, search]);

  useEffect(() => {
    setPage(0);
  }, [activeTab, namespaceFilter, statusFilter, search, selectedCluster]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection(key === "age" ? "desc" : "asc");
  };

  const renderSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return sortDirection === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />;
  };

  const renderRows = (items: any[]) => {
    if (activeTab === "pods") {
      return items.map((pod: any) => (
        <tr key={pod.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(pod)}>
          <td className="px-4 py-3 font-mono text-xs">{pod.name}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{pod.namespace}</td>
          <td className={`px-4 py-3 text-xs font-medium capitalize ${podStatusColors[pod.status] || "text-muted-foreground"}`}>{pod.status}</td>
          <td className="px-4 py-3 font-mono text-xs">{pod.ready_containers}/{pod.container_count}</td>
          <td className="px-4 py-3 font-mono text-xs">{pod.restart_count}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{pod.node_name || "-"}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(pod.started_at)}</td>
        </tr>
      ));
    }
    if (activeTab === "deployments") {
      return items.map((dep: any) => (
        <tr key={dep.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(dep)}>
          <td className="px-4 py-3 font-mono text-xs">{dep.name}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{dep.namespace}</td>
          <td className="px-4 py-3"><StatusBadge variant={dep.status === "healthy" ? "healthy" : dep.status === "critical" ? "critical" : "warning"}>{dep.status}</StatusBadge></td>
          <td className="px-4 py-3 font-mono text-xs">{dep.ready_replicas}/{dep.desired_replicas}</td>
          <td className="px-4 py-3 font-mono text-xs">{dep.updated_replicas}</td>
          <td className="px-4 py-3 font-mono text-xs">{dep.available_replicas}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(dep.created_at)}</td>
        </tr>
      ));
    }
    if (activeTab === "statefulsets") {
      return items.map((sts: any) => (
        <tr key={sts.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(sts)}>
          <td className="px-4 py-3 font-mono text-xs">{sts.name}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{sts.namespace}</td>
          <td className={`px-4 py-3 text-xs font-medium ${podStatusColors[sts.status] || "text-muted-foreground"}`}>{sts.status}</td>
          <td className="px-4 py-3 font-mono text-xs">{sts.ready_replicas}/{sts.desired_replicas}</td>
          <td className="px-4 py-3 font-mono text-xs">{sts.service_name || "-"}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(sts.created_at)}</td>
        </tr>
      ));
    }
    if (activeTab === "daemonsets") {
      return items.map((ds: any) => (
        <tr key={ds.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(ds)}>
          <td className="px-4 py-3 font-mono text-xs">{ds.name}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{ds.namespace}</td>
          <td className={`px-4 py-3 text-xs font-medium ${podStatusColors[ds.status] || "text-muted-foreground"}`}>{ds.status}</td>
          <td className="px-4 py-3 font-mono text-xs">{ds.number_ready}/{ds.desired_number_scheduled}</td>
          <td className="px-4 py-3 font-mono text-xs">{ds.updated_number_scheduled}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(ds.created_at)}</td>
        </tr>
      ));
    }
    if (activeTab === "jobs") {
      return items.map((job: any) => (
        <tr key={job.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(job)}>
          <td className="px-4 py-3 font-mono text-xs">{job.name}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{job.namespace}</td>
          <td className="px-4 py-3 text-xs">{job.kind}</td>
          <td className={`px-4 py-3 text-xs font-medium ${podStatusColors[job.status] || "text-muted-foreground"}`}>{job.status}</td>
          <td className="px-4 py-3 font-mono text-xs">{job.succeeded}/{job.completions || 0}</td>
          <td className="px-4 py-3 font-mono text-xs">{job.schedule || "-"}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(job.created_at)}</td>
        </tr>
      ));
    }
    if (activeTab === "services") {
      return items.map((svc: any) => (
        <tr key={svc.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(svc)}>
          <td className="px-4 py-3 font-mono text-xs">{svc.name}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{svc.namespace}</td>
          <td className="px-4 py-3 text-xs">{svc.service_type}</td>
          <td className="px-4 py-3 font-mono text-xs">{svc.cluster_ip || "-"}</td>
          <td className="px-4 py-3 font-mono text-xs">{svc.external_ip || "-"}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{(svc.ports || []).map((p: any) => p.port).join(", ") || "-"}</td>
        </tr>
      ));
    }
    if (activeTab === "nodes") {
      return items.map((node: any) => (
        <tr key={node.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(node)}>
          <td className="px-4 py-3 font-mono text-xs">{node.name}</td>
          <td className="px-4 py-3"><StatusBadge variant={node.status === "ready" ? "healthy" : "critical"}>{node.status}</StatusBadge></td>
          <td className="px-4 py-3 text-xs">{node.role || "worker"}</td>
          <td className="px-4 py-3 font-mono text-xs">{node.kubelet_version || "-"}</td>
          <td className="px-4 py-3 font-mono text-xs">{node.cpu_usage_percent}%</td>
          <td className="px-4 py-3 font-mono text-xs">{node.memory_usage_percent}%</td>
        </tr>
      ));
    }
    if (activeTab === "events") {
      return items.map((evt: any) => (
        <tr key={evt.id} className="cursor-pointer hover:bg-surface/60" onClick={() => setSelectedResource(evt)}>
          <td className={`px-4 py-3 text-xs font-medium ${evt.type === "Warning" ? "text-warning" : "text-success"}`}>{evt.type}</td>
          <td className="px-4 py-3 text-xs">{evt.reason || "-"}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{evt.involved_kind || "Object"} / {evt.involved_name || "-"}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{evt.namespace || "-"}</td>
          <td className="px-4 py-3 text-xs text-muted-foreground">{fmtAge(evt.event_time || evt.last_seen)}</td>
        </tr>
      ));
    }
    return null;
  };

  const tableHead = () => {
    switch (activeTab) {
      case "pods":
        return [
          { key: "name", label: "Name" },
          { key: "namespace", label: "Namespace" },
          { key: "status", label: "Status" },
          { key: "ready", label: "Ready" },
          { key: "restarts", label: "Restarts" },
          { key: "node", label: "Node" },
          { key: "age", label: "Age" },
        ];
      case "deployments":
        return [
          { key: "name", label: "Name" },
          { key: "namespace", label: "Namespace" },
          { key: "status", label: "Status" },
          { key: "ready", label: "Ready" },
          { key: "updated", label: "Updated" },
          { key: "available", label: "Available" },
          { key: "age", label: "Age" },
        ];
      case "statefulsets":
        return [
          { key: "name", label: "Name" },
          { key: "namespace", label: "Namespace" },
          { key: "status", label: "Status" },
          { key: "ready", label: "Ready" },
          { key: "service", label: "Service" },
          { key: "age", label: "Age" },
        ];
      case "daemonsets":
        return [
          { key: "name", label: "Name" },
          { key: "namespace", label: "Namespace" },
          { key: "status", label: "Status" },
          { key: "ready", label: "Ready" },
          { key: "updated", label: "Updated" },
          { key: "age", label: "Age" },
        ];
      case "jobs":
        return [
          { key: "name", label: "Name" },
          { key: "namespace", label: "Namespace" },
          { key: "type", label: "Kind" },
          { key: "status", label: "Status" },
          { key: "ready", label: "Done" },
          { key: "schedule", label: "Schedule" },
          { key: "age", label: "Age" },
        ];
      case "services":
        return [
          { key: "name", label: "Name" },
          { key: "namespace", label: "Namespace" },
          { key: "type", label: "Type" },
          { key: "cluster_ip", label: "Cluster IP" },
          { key: "external", label: "External" },
          { key: "ports", label: "Ports" },
        ];
      case "nodes":
        return [
          { key: "name", label: "Name" },
          { key: "status", label: "Status" },
          { key: "role", label: "Role" },
          { key: "version", label: "Version" },
          { key: "cpu", label: "CPU" },
          { key: "memory", label: "Memory" },
        ];
      case "events":
        return [
          { key: "status", label: "Type" },
          { key: "reason", label: "Reason" },
          { key: "object", label: "Object" },
          { key: "namespace", label: "Namespace" },
          { key: "age", label: "Age" },
        ];
      default:
        return [];
    }
  };

  const counts = {
    deployments: stats?.deployment_count ?? deployments.length,
    statefulsets: stats?.statefulset_count ?? statefulsets.length,
    daemonsets: stats?.daemonset_count ?? daemonsets.length,
    jobs: stats?.job_count ?? jobs.length,
    services: stats?.service_count ?? services.length,
  };

  return (
    <div className="flex h-[calc(100vh-5.5rem)] flex-col gap-4 overflow-hidden p-4 xl:h-[calc(100vh-6rem)]">
      <PageHeader title="Kubernetes" description="Lens-style read-only cluster views with compact operational focus">
        <button onClick={() => setShowAddCluster(true)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Cluster
        </button>

      </PageHeader>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden 2xl:grid-cols-[minmax(0,1.45fr)_420px] xl:grid-cols-[minmax(0,1.25fr)_380px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {selectedClusterData && (
            <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{selectedClusterData.name}</h2><StatusBadge variant={selectedClusterData.status}>{selectedClusterData.status}</StatusBadge></div>
                  <p className="mt-1 text-sm text-muted-foreground">Read-only cluster explorer modelled after Lens, minus the dangerous buttons.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => discoverMutation.mutate(selectedClusterData.id)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface"><RefreshCw className={`h-4 w-4 ${discoverMutation.isPending ? "animate-spin" : ""}`} />Refresh</button>
                  <button onClick={() => deleteMutation.mutate(selectedClusterData.id)} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-critical"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6 xl:grid-cols-3">
                <div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Nodes</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.node_count}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Pods</div><div className="mt-1 text-xl font-semibold">{selectedClusterData.pod_count}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Deployments</div><div className="mt-1 text-xl font-semibold">{counts.deployments}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">StatefulSets</div><div className="mt-1 text-xl font-semibold">{counts.statefulsets}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">DaemonSets</div><div className="mt-1 text-xl font-semibold">{counts.daemonsets}</div></div>
                <div className="rounded-lg bg-surface p-3"><div className="text-xs text-muted-foreground">Jobs</div><div className="mt-1 text-xl font-semibold">{counts.jobs}</div></div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background/40 p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground"><Cpu className="mr-1 inline h-3 w-3" />CPU</span><span className="font-mono">{selectedClusterData.cpu_usage_percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(selectedClusterData.cpu_usage_percent, 100)}%` }} /></div></div>
                <div className="rounded-lg border border-border bg-background/40 p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground"><HardDrive className="mr-1 inline h-3 w-3" />Memory</span><span className="font-mono">{selectedClusterData.memory_usage_percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(selectedClusterData.memory_usage_percent, 100)}%` }} /></div></div>
                <div className="rounded-lg border border-border bg-background/40 p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground"><Container className="mr-1 inline h-3 w-3" />Max pods</span><span className="font-mono">{Math.min(100, Math.round(((selectedClusterData.pod_count || 0) / Math.max((selectedClusterData.node_count || 1) * 110, 1)) * 100))}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, Math.round(((selectedClusterData.pod_count || 0) / Math.max((selectedClusterData.node_count || 1) * 110, 1)) * 100))}%` }} /></div><div className="mt-2 text-[11px] text-muted-foreground">{selectedClusterData.pod_count || 0} / {Math.max((selectedClusterData.node_count || 1) * 110, 1)} estimated pod slots</div></div>
              </div>
            </div>
          )}

          <div className="grid gap-3 rounded-xl border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected cluster</div>
                <div className="mt-1 text-sm font-medium text-foreground">{selectedClusterData?.name || selectedClusterData?.cluster_name || selectedCluster || "No cluster selected"}</div>
              </div>
              <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cluster count</div>
                <div className="mt-1 text-sm font-medium text-foreground">{clusters.length}</div>
              </div>
              <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current view</div>
                <div className="mt-1 text-sm font-medium capitalize text-foreground">{activeTab}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-start justify-start gap-2 lg:justify-end">
              <Link to={`/?`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Dashboard</Link>
              <Link to={`/kubernetes?tab=overview${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Overview</Link>
              <Link to={`/kubernetes?tab=workloads${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Workloads</Link>
              <Link to={`/kubernetes?tab=nodes${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Nodes</Link>
              <Link to={`/kubernetes?tab=events${selectedCluster ? `&cluster=${selectedCluster}` : ''}`} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Events</Link>
              <Link to="/proxmox?tab=overview" className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Proxmox</Link>
              <Link to="/swarm?tab=overview" className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">Swarm</Link>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden">
            <div className="sticky top-0 z-20 border-b border-border bg-card px-3 py-3 sm:px-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {resourceTabs.map((tab) => {
                  const Icon = tab.icon;
                  return <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${activeTab === tab.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}><Icon className="h-4 w-4" />{tab.label}</button>;
                })}
              </div>
              {activeTab !== "overview" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${activeTab}...`} className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none" />
                  </div>
                  <FilterChip active={groupByNamespace} onClick={() => setGroupByNamespace(v => !v)}>Group by namespace</FilterChip>
                  {activeTab === "events" && <FilterChip active={statusFilter === "Warning"} onClick={() => setStatusFilter(statusFilter === "Warning" ? "" : "Warning")}>Warnings only</FilterChip>}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-2">
                  <div className="rounded-lg border border-border p-3"><h3 className="mb-2 text-sm font-semibold">Hotspots</h3><div className="space-y-1.5">{(stats?.top_restarting_pods || []).map((pod: any) => <button key={pod.id} onClick={() => { setActiveTab("pods"); setSelectedResource(pod); }} className="flex w-full items-center justify-between rounded-md bg-surface px-3 py-2 text-left text-sm hover:bg-surface/80"><div><div className="font-mono text-xs">{pod.name}</div><div className="text-xs text-muted-foreground">{pod.namespace}</div></div><div className="text-xs font-mono text-warning">{pod.restart_count} restarts</div></button>)}{(!stats?.top_restarting_pods || stats.top_restarting_pods.length === 0) && <p className="text-sm text-muted-foreground">No restart hotspots. Lovely.</p>}</div></div>
                  <div className="rounded-lg border border-border p-3"><h3 className="mb-2 text-sm font-semibold">Current shape</h3><div className="space-y-2 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">Pod states</span><span className="font-mono text-xs">{JSON.stringify(stats?.pods_by_status || {})}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Node states</span><span className="font-mono text-xs">{JSON.stringify(stats?.nodes_by_status || {})}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Deployment health</span><span className="font-mono text-xs">{JSON.stringify(stats?.deployments_by_status || {})}</span></div></div></div>
                  <div className="rounded-lg border border-border p-3 xl:col-span-2"><h3 className="mb-2 text-sm font-semibold">Recent warning events</h3><div className="space-y-1.5">{events.filter((evt: any) => evt.type === "Warning").slice(0, 8).map((evt: any) => <button key={evt.id} onClick={() => { setActiveTab("events"); setSelectedResource(evt); }} className="flex w-full items-start justify-between rounded-md bg-surface px-3 py-2 text-left hover:bg-surface/80"><div><div className="text-sm font-medium">{evt.reason || "Warning"}</div><div className="text-xs text-muted-foreground">{evt.namespace || "cluster"} · {evt.involved_kind || "Object"} / {evt.involved_name || "-"}</div></div><div className="text-xs text-muted-foreground">{fmtAge(evt.event_time || evt.last_seen)}</div></button>)}{events.filter((evt: any) => evt.type === "Warning").length === 0 && <p className="text-sm text-muted-foreground">No recent warning events.</p>}</div></div>

                  <div className="rounded-lg border border-border p-3 xl:col-span-2"><h3 className="mb-2 text-sm font-semibold">Namespace dashboards</h3><div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3 xl:grid-cols-2">{namespaceDashboards.slice(0, 9).map((ns: any) => <div key={ns.name} className="rounded-lg border border-border bg-surface/60 p-3 text-left"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{ns.name}</div><div className="mt-1 text-xs text-muted-foreground">{ns.podCount} pods · {ns.deploymentCount} deployments · {ns.serviceCount} services</div></div><div className="text-right text-xs"><div className={`${ns.warningCount > 0 ? "text-warning" : "text-muted-foreground"}`}>{ns.warningCount} warn</div><div className={`${ns.restartTotal > 0 ? "text-primary" : "text-muted-foreground"}`}>{ns.restartTotal} restarts</div></div></div>{ns.unhealthyDeployments.length > 0 && <div className="mt-3 text-xs text-warning">Unhealthy: {ns.unhealthyDeployments.slice(0, 2).map((d: any) => d.name).join(", ")}</div>}{ns.exposedServices.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Exposed: {ns.exposedServices.slice(0, 2).map((s: any) => s.name).join(", ")}</div>}</div>)}</div></div>
                </div>
              )}

              {activeTab !== "overview" && (
                <>
                  <table className="w-full min-w-[820px] text-sm xl:min-w-full">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">{tableHead().map((h: any) => <th key={h.key} className="px-4 py-3"><button type="button" onClick={() => toggleSort(h.key)} className="flex items-center gap-1 text-left">{h.label}{renderSortIcon(h.key)}</button></th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {groupedItems ? groupedItems.flatMap(([group, items]) => [
                        <GroupHeaderRow key={`group-${group}`} title={group} count={items.length} colSpan={tableHead().length} />,
                        ...renderRows(items),
                      ]) : renderRows(pagedItems)}
                    </tbody>
                  </table>
                  {!groupedItems && sortedItems.length > pageSize && (
                    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
                      <span>Page {page + 1} of {totalPages} · {sortedItems.length} items</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Prev</button>
                        <button type="button" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page >= totalPages - 1} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 disabled:opacity-40">Next<ChevronRight className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 space-y-4 overflow-auto xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-6rem)]">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between px-1"><h3 className="text-sm font-semibold">Clusters</h3><span className="text-xs text-muted-foreground">{clusters.length}</span></div>
            <div className="space-y-2">
              {clusters.map((cluster: any) => (
                <button key={cluster.id} onClick={() => setSelectedCluster(cluster.id)} className={`w-full rounded-lg border p-3 text-left transition-all ${selectedCluster === cluster.id ? "border-primary/50 bg-primary/5" : "border-border bg-surface/40 hover:border-primary/30"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2"><Container className="h-4 w-4 text-primary" /><span className="text-sm font-medium">{cluster.name}</span></div>
                      <p className="mt-1 text-xs text-muted-foreground">{cluster.version ? `v${cluster.version}` : "Unknown version"}</p>
                    </div>
                    <StatusBadge variant={cluster.status}>{cluster.status}</StatusBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.node_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nodes</div></div>
                    <div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{cluster.pod_count}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pods</div></div>
                    <div className="rounded-md bg-background/60 px-2 py-2"><div className="font-semibold">{selectedCluster === cluster.id ? counts.deployments : "-"}</div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">Deploy</div></div>
                  </div>
                </button>
              ))}
              {clusters.length === 0 && !isLoading && <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No clusters connected.</div>}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 px-1"><h3 className="text-sm font-semibold">Scope</h3></div>
            <div className="space-y-3">
              <FilterDropdown
                label="Namespace"
                value={namespaceFilter}
                onChange={setNamespaceFilter}
                options={namespaceOptions.map((ns) => ({ value: ns, label: ns === "all" ? "All namespaces" : ns }))}
              />
              {activeTab === "pods" && (
                <FilterDropdown
                  label="Pod status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "", label: "All statuses" },
                    { value: "running", label: "Running" },
                    { value: "pending", label: "Pending" },
                    { value: "failed", label: "Failed" },
                    { value: "succeeded", label: "Succeeded" },
                  ]}
                />
              )}
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-xs">
                <div>
                  <div className="font-medium text-foreground">Group by namespace</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">Cluster resources grouped into namespace sections</div>
                </div>
                <button
                  onClick={() => setGroupByNamespace(v => !v)}
                  className={`inline-flex min-w-[72px] items-center justify-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    groupByNamespace
                      ? "border-primary/40 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      : "border-border bg-background text-foreground hover:bg-surface-hover"
                  }`}
                >
                  {groupByNamespace ? "Enabled" : "Disabled"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2"><ChevronRight className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-semibold">Details</h3></div>
            {!selectedResource && <div className="rounded-lg border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">Pick a row to inspect it.</div>}
            {selectedResource && (
              <div className="space-y-3">
                <DetailRow label="Name" value={selectedResource.name || selectedResource.involved_name} />
                <DetailRow label="Namespace" value={selectedResource.namespace} />
                <DetailRow label="Status" value={selectedResource.status || selectedResource.type} />
                {selectedResource.kind !== undefined && <DetailRow label="Kind" value={selectedResource.kind} />}
                {selectedResource.node_name !== undefined && <DetailRow label="Node" value={selectedResource.node_name} />}
                {selectedResource.reason !== undefined && <DetailRow label="Reason" value={selectedResource.reason} />}
                {selectedResource.cluster_ip !== undefined && <DetailRow label="Cluster IP" value={selectedResource.cluster_ip} />}
                {selectedResource.external_ip !== undefined && <DetailRow label="External" value={selectedResource.external_ip} />}
                {selectedResource.strategy !== undefined && <DetailRow label="Strategy" value={selectedResource.strategy} />}
                {selectedResource.service_name !== undefined && <DetailRow label="Headless svc" value={selectedResource.service_name} />}
                {selectedResource.schedule !== undefined && <DetailRow label="Schedule" value={selectedResource.schedule} />}
                {selectedResource.event_time && <DetailRow label="Event time" value={new Date(selectedResource.event_time).toLocaleString()} />}
                {selectedResource.created_at && <DetailRow label="Created" value={new Date(selectedResource.created_at).toLocaleString()} />}

                {selectedResource.ready_replicas !== undefined && <DetailRow label="Ready" value={`${selectedResource.ready_replicas}/${selectedResource.desired_replicas}`} />}
                {selectedResource.updated_replicas !== undefined && <DetailRow label="Updated" value={selectedResource.updated_replicas} />}
                {selectedResource.available_replicas !== undefined && <DetailRow label="Available" value={selectedResource.available_replicas} />}
                {selectedResource.number_ready !== undefined && <DetailRow label="DS ready" value={`${selectedResource.number_ready}/${selectedResource.desired_number_scheduled}`} />}
                {selectedResource.active !== undefined && <DetailRow label="Active" value={selectedResource.active} />}
                {selectedResource.succeeded !== undefined && <DetailRow label="Succeeded" value={selectedResource.succeeded} />}
                {selectedResource.failed !== undefined && <DetailRow label="Failed" value={selectedResource.failed} />}
                {selectedResource.ready_containers !== undefined && <DetailRow label="Containers" value={`${selectedResource.ready_containers}/${selectedResource.container_count}`} />}
                {selectedResource.restart_count !== undefined && <DetailRow label="Restarts" value={selectedResource.restart_count} />}
                {selectedResource.cpu_usage !== undefined && <DetailRow label="CPU" value={selectedResource.cpu_usage} />}
                {selectedResource.memory_usage !== undefined && <DetailRow label="Memory" value={selectedResource.memory_usage} />}

                {selectedResource.message && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Message</div><div className="rounded-lg bg-surface p-3 text-sm text-foreground">{selectedResource.message}</div></div>}
                {selectedResource.selector && Object.keys(selectedResource.selector).length > 0 && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Selector</div><div className="rounded-lg bg-surface p-3 font-mono text-xs text-foreground">{Object.entries(selectedResource.selector).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}</div></div>}
                {selectedResource.labels && Object.keys(selectedResource.labels).length > 0 && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Labels</div><div className="rounded-lg bg-surface p-3 font-mono text-xs text-foreground">{Object.entries(selectedResource.labels).slice(0, 24).map(([k, v]) => <div key={k}>{k}: {String(v)}</div>)}</div></div>}
                {selectedResource.ports && <div className="space-y-2 pt-2"><div className="text-xs text-muted-foreground">Ports</div><div className="rounded-lg bg-surface p-3 font-mono text-xs text-foreground">{(selectedResource.ports || []).map((port: any, idx: number) => <div key={idx}>{port.name || "port"}: {port.port}/{port.protocol}{port.targetPort ? ` → ${port.targetPort}` : ""}</div>)}</div></div>}
                {relatedResources && selectedResource.namespace && <div className="space-y-3 pt-2">
                  <div>
                    <div className="mb-2 text-xs text-muted-foreground">Related deployments</div>
                    <div className="space-y-2">{relatedResources.relatedDeployments.slice(0, 6).map((dep: any) => <button key={dep.id} onClick={() => { setActiveTab("deployments"); setSelectedResource(dep); }} className="flex w-full items-center justify-between rounded-lg bg-surface p-3 text-left text-xs hover:bg-surface/80"><span className="font-mono text-foreground">{dep.name}</span><span className="text-muted-foreground">{dep.ready_replicas}/{dep.desired_replicas}</span></button>)}{relatedResources.relatedDeployments.length === 0 && <div className="rounded-lg bg-surface p-3 text-xs text-muted-foreground">No related deployments.</div>}</div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs text-muted-foreground">Related pods</div>
                    <div className="space-y-2">{relatedResources.relatedPods.slice(0, 6).map((pod: any) => <button key={pod.id} onClick={() => { setActiveTab("pods"); setSelectedResource(pod); }} className="flex w-full items-center justify-between rounded-lg bg-surface p-3 text-left text-xs hover:bg-surface/80"><span className="font-mono text-foreground">{pod.name}</span><span className="text-muted-foreground">{pod.ready_containers}/{pod.container_count}</span></button>)}{relatedResources.relatedPods.length === 0 && <div className="rounded-lg bg-surface p-3 text-xs text-muted-foreground">No related pods.</div>}</div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs text-muted-foreground">Related services</div>
                    <div className="space-y-2">{relatedResources.relatedServices.slice(0, 6).map((svc: any) => <button key={svc.id} onClick={() => { setActiveTab("services"); setSelectedResource(svc); }} className="flex w-full items-center justify-between rounded-lg bg-surface p-3 text-left text-xs hover:bg-surface/80"><span className="font-mono text-foreground">{svc.name}</span><span className="text-muted-foreground">{svc.service_type}</span></button>)}{relatedResources.relatedServices.length === 0 && <div className="rounded-lg bg-surface p-3 text-xs text-muted-foreground">No related services.</div>}</div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs text-muted-foreground">Related events</div>
                    <div className="space-y-2">{relatedResources.relatedEvents.slice(0, 6).map((evt: any) => <button key={evt.id} onClick={() => { setActiveTab("events"); setSelectedResource(evt); }} className="w-full rounded-lg bg-surface p-3 text-left text-xs hover:bg-surface/80"><div className={`font-medium ${evt.type === "Warning" ? "text-warning" : "text-success"}`}>{evt.reason || evt.type}</div><div className="mt-1 text-muted-foreground">{evt.message || `${evt.involved_kind || "Object"} / ${evt.involved_name || "-"}`}</div></button>)}{relatedResources.relatedEvents.length === 0 && <div className="rounded-lg bg-surface p-3 text-xs text-muted-foreground">No closely related events found.</div>}</div>
                  </div>
                </div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAddCluster && (
          <>
            <motion.div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddCluster(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl" initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 8 }}>
                <div className="border-b border-border px-6 py-4"><h2 className="text-lg font-semibold">Add Kubernetes Cluster</h2><p className="mt-0.5 text-xs text-muted-foreground">Paste a kubeconfig and Vordr will use the cluster endpoint from it.</p></div>
                <div className="space-y-4 p-6">
                  <div><label className="mb-1.5 block text-sm font-medium">Cluster Name</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. production-cluster" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50" /></div>
                  <div><label className="mb-1.5 block text-sm font-medium">Kubeconfig</label><textarea value={newKubeconfig} onChange={(e) => setNewKubeconfig(e.target.value)} rows={8} placeholder="Paste your kubeconfig YAML here..." className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50" /></div>
                </div>
                <div className="flex justify-end gap-3 border-t border-border px-6 py-4"><button onClick={() => setShowAddCluster(false)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover">Cancel</button><button onClick={handleCreate} disabled={!newName || !newKubeconfig.trim() || createMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}Connect Cluster</button></div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>

  );
}
