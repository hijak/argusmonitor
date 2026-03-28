import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ArrowRight, Bot, CheckCircle, CheckCircle2, Clock, Plus, User } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

const typeColors: Record<string, string> = {
  alert: "text-critical",
  system: "text-muted-foreground",
  ai: "text-primary",
  action: "text-success",
};

const typeBg: Record<string, string> = {
  alert: "bg-critical/10",
  system: "bg-muted",
  ai: "bg-primary/10",
  action: "bg-success/10",
};

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeHosts(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "resolved">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<any | null>(null);
  const [newIncidentTitle, setNewIncidentTitle] = useState("");
  const [newIncidentSeverity, setNewIncidentSeverity] = useState("warning");
  const [newIncidentHosts, setNewIncidentHosts] = useState("");
  const [updateType, setUpdateType] = useState("action");
  const [updateText, setUpdateText] = useState("");

  const {
    data: incidents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["incidents"],
    queryFn: api.listIncidents,
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createIncident(payload),
    onSuccess: () => {
      toast.success("Incident created");
      setCreateOpen(false);
      setNewIncidentTitle("");
      setNewIncidentSeverity("warning");
      setNewIncidentHosts("");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create incident"),
  });

  const addEventMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => api.addIncidentEvent(id, payload),
    onSuccess: () => {
      toast.success("Incident update added");
      setUpdateTarget(null);
      setUpdateType("action");
      setUpdateText("");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add incident update"),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.resolveIncident(id),
    onSuccess: () => {
      toast.success("Incident resolved");
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to resolve incident"),
  });

  const filteredIncidents = useMemo(() => {
    if (statusFilter === "resolved") return incidents.filter((inc: any) => inc.status === "resolved");
    if (statusFilter === "active") return incidents.filter((inc: any) => inc.status !== "resolved");
    return incidents;
  }, [incidents, statusFilter]);

  const counts = useMemo(() => ({
    total: incidents.length,
    active: incidents.filter((inc: any) => inc.status !== "resolved").length,
    resolved: incidents.filter((inc: any) => inc.status === "resolved").length,
    critical: incidents.filter((inc: any) => inc.severity === "critical" && inc.status !== "resolved").length,
  }), [incidents]);

  const openCreate = () => {
    setNewIncidentTitle("");
    setNewIncidentSeverity("warning");
    setNewIncidentHosts("");
    setCreateOpen(true);
  };

  const openUpdate = (incident: any) => {
    setUpdateTarget(incident);
    setUpdateType(incident.status === "resolved" ? "system" : "action");
    setUpdateText("");
  };

  return (
    <motion.div className="space-y-5 p-4 sm:space-y-6 sm:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Incidents" description="Track active incidents, post timeline updates, and close the loop cleanly.">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All" },
                { value: "active", label: "Active" },
                { value: "resolved", label: "Resolved" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value as "all" | "active" | "resolved")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    statusFilter === option.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button onClick={openCreate} className="min-h-11">
              <Plus className="h-4 w-4" /> New incident
            </Button>
          </div>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active incidents" value={counts.active} icon={<AlertTriangle className="h-4 w-4 text-critical" />} className="p-4" />
        <MetricCard label="Critical active" value={counts.critical} icon={<AlertTriangle className="h-4 w-4 text-warning" />} className="p-4" />
        <MetricCard label="Resolved" value={counts.resolved} icon={<CheckCircle2 className="h-4 w-4 text-success" />} className="p-4" />
        <MetricCard label="Total tracked" value={counts.total} icon={<Clock className="h-4 w-4 text-primary" />} className="p-4" />
      </motion.div>

      <motion.div variants={item}>
        <SectionCard
          title="Incident feed"
          description="Active and recent incidents with ownership, impact, and timeline updates."
          icon={<AlertTriangle className="h-4 w-4" />}
          contentClassName="p-0"
        >
          {isLoading && <div className="px-5 py-8 text-sm text-muted-foreground">Loading incidents…</div>}
          {!isLoading && error && (
            <div className="px-5 py-8 text-sm text-critical">{error instanceof Error ? error.message : "Failed to load incidents"}</div>
          )}
          {!isLoading && !error && filteredIncidents.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No incidents matching the current filter.</div>
          )}

          {!isLoading && !error && filteredIncidents.length > 0 && (
            <div className="divide-y divide-border/80">
              {filteredIncidents.map((inc: any) => {
                const isResolved = inc.status === "resolved";
                return (
                  <motion.div key={inc.id} variants={item} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-4 border-b border-border/70 pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{inc.ref}</span>
                          <StatusBadge variant={inc.severity} pulse={!isResolved}>{inc.severity}</StatusBadge>
                          <span className={`rounded-md px-2 py-0.5 text-xs capitalize ${isResolved ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                            {inc.status}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-foreground">{inc.title}</h3>

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Started {timeSince(inc.started_at)} ago</span>
                          <span>{new Date(inc.started_at).toLocaleString()}</span>
                          {inc.resolved_at && <span>Resolved {new Date(inc.resolved_at).toLocaleString()}</span>}
                        </div>

                        {inc.assigned_user && (
                          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            <User className="h-3 w-3" /> On call: {inc.assigned_user.name}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">Affected:</span>
                          {(inc.affected_hosts || []).length > 0 ? (
                            (inc.affected_hosts || []).map((host: string) => (
                              <span key={host} className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                                {host}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">None listed</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button variant="outline" onClick={() => openUpdate(inc)}>
                          <Plus className="h-4 w-4" /> Add update
                        </Button>
                        {!isResolved && (
                          <Button
                            variant="outline"
                            onClick={() => resolveMutation.mutate(inc.id)}
                            disabled={resolveMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Resolve
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="pt-4">
                      <div className="space-y-0">
                        {(inc.events || []).length === 0 && (
                          <div className="text-sm text-muted-foreground">No updates yet.</div>
                        )}

                        {(inc.events || []).map((event: any, index: number) => (
                          <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                            {index < inc.events.length - 1 && (
                              <div className="absolute left-[11px] top-[24px] h-[calc(100%-8px)] w-px bg-border" />
                            )}
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${typeBg[event.type] || "bg-muted"}`}>
                              {event.type === "alert" && <AlertTriangle className={`h-3 w-3 ${typeColors[event.type]}`} />}
                              {event.type === "system" && <ArrowRight className={`h-3 w-3 ${typeColors[event.type]}`} />}
                              {event.type === "ai" && <Bot className={`h-3 w-3 ${typeColors[event.type]}`} />}
                              {event.type === "action" && <CheckCircle className={`h-3 w-3 ${typeColors[event.type]}`} />}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <p className={`text-sm leading-6 ${event.type === "ai" ? "text-primary" : "text-foreground"}`}>
                                {event.event_text}
                              </p>
                            </div>
                            <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </motion.div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create incident</DialogTitle>
            <DialogDescription>Open a manual incident with severity and affected hosts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="incident-title">Title</Label>
              <Input
                id="incident-title"
                value={newIncidentTitle}
                onChange={(e) => setNewIncidentTitle(e.target.value)}
                placeholder="API latency spike in eu-west"
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={newIncidentSeverity} onValueChange={setNewIncidentSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-hosts">Affected hosts</Label>
              <Textarea
                id="incident-hosts"
                value={newIncidentHosts}
                onChange={(e) => setNewIncidentHosts(e.target.value)}
                rows={3}
                placeholder="db-01, api-02, edge-lon-1"
              />
              <p className="text-xs text-muted-foreground">Comma-separated hostnames. Leave blank if this is wider than a host list.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                title: newIncidentTitle.trim(),
                severity: newIncidentSeverity,
                affected_hosts: normalizeHosts(newIncidentHosts),
              })}
              disabled={createMutation.isPending || !newIncidentTitle.trim()}
            >
              {createMutation.isPending ? "Creating..." : "Create incident"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!updateTarget} onOpenChange={(open) => !open && setUpdateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add incident update</DialogTitle>
            <DialogDescription>
              {updateTarget ? `Post a timeline update to ${updateTarget.ref} — ${updateTarget.title}` : "Add incident update"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Update type</Label>
              <Select value={updateType} onValueChange={setUpdateType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select update type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="action">Action</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="alert">Alert</SelectItem>
                  <SelectItem value="ai">AI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident-update">Update</Label>
              <Textarea
                id="incident-update"
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                rows={4}
                placeholder="Mitigation applied, error rate dropping, continuing to monitor."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUpdateTarget(null)}>Cancel</Button>
            <Button
              onClick={() => updateTarget && addEventMutation.mutate({
                id: updateTarget.id,
                payload: { type: updateType, event_text: updateText.trim() },
              })}
              disabled={addEventMutation.isPending || !updateTarget || !updateText.trim()}
            >
              {addEventMutation.isPending ? "Posting..." : "Post update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
