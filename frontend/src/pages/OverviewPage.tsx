import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Expand, Eye, MonitorUp, ShieldAlert, Shrink, Siren } from "lucide-react";
import { api } from "@/lib/api";
import { getWorkspaceId } from "@/lib/workspace";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WorldMap, type WorldPing } from "@/components/WorldMap";
import { HostDetailModal } from "@/components/HostDetailModal";
import { toast } from "@/components/ui/sonner";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.02 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };
const severityOrder = ["critical", "warning", "info"] as const;
const severityRank: Record<string, number> = { critical: 3, warning: 2, info: 1, healthy: 0 };

const fakeCoords: Record<string, { x: number; y: number }> = {
  london: { x: 0.49, y: 0.24 },
  lincoln: { x: 0.492, y: 0.205 },
  usa: { x: 0.2, y: 0.3 },
  us: { x: 0.2, y: 0.3 },
  frankfurt: { x: 0.53, y: 0.23 },
  singapore: { x: 0.8, y: 0.54 },
  sydney: { x: 0.88, y: 0.76 },
  tokyo: { x: 0.86, y: 0.33 },
};

function severityMeta(severity?: string) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return { icon: Siren, bar: "bg-red-600", panel: "bg-red-950/80 text-red-50 border-red-500/50", text: "text-red-200", pill: "bg-red-600 text-white" };
    case "warning":
      return { icon: AlertTriangle, bar: "bg-amber-500", panel: "bg-amber-950/80 text-amber-50 border-amber-400/50", text: "text-amber-100", pill: "bg-amber-400 text-black" };
    case "info":
      return { icon: Bell, bar: "bg-sky-500", panel: "bg-sky-950/80 text-sky-50 border-sky-400/50", text: "text-sky-100", pill: "bg-sky-500 text-white" };
    default:
      return { icon: CheckCircle2, bar: "bg-emerald-500", panel: "bg-emerald-950/70 text-emerald-50 border-emerald-400/40", text: "text-emerald-100", pill: "bg-emerald-500 text-white" };
  }
}

function relativeTime(value?: string | null) {
  if (!value) return "unknown time";
  const then = new Date(value).getTime();
  const diffMins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const hours = Math.round(diffMins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function totalExtraOccurrences(alerts: any[]) {
  return alerts.reduce((sum, alert) => sum + Math.max(0, Number(alert.occurrence_count || 1) - 1), 0);
}

function alertGroup(alert: any) {
  return alert.host || alert.service || "Ungrouped";
}

function hostLocation(host: any, idx: number) {
  const hostCoords = host?.latitude != null && host?.longitude != null
    ? { x: (Number(host.longitude) + 180) / 360, y: (90 - Number(host.latitude)) / 180 }
    : null;
  const text = `${host?.name || ""} ${host?.ip_address || ""}`.toLowerCase();
  const direct = Object.entries(fakeCoords).find(([key]) => text.includes(key))?.[1];
  const fallback = [
    { x: 0.492, y: 0.205 },
    { x: 0.2, y: 0.3 },
    { x: 0.8, y: 0.54 },
    { x: 0.86, y: 0.33 },
    { x: 0.66, y: 0.42 },
  ][idx % 5];
  return hostCoords || direct || fallback;
}

function buildLocationPings(alerts: any[], hosts: any[]): WorldPing[] {
  const alertMap = new Map<string, any[]>();
  alerts.forEach((alert: any) => {
    const key = String(alert.host || "").toLowerCase();
    if (!key) return;
    if (!alertMap.has(key)) alertMap.set(key, []);
    alertMap.get(key)!.push(alert);
  });

  const groups = new Map<string, {
    x: number;
    y: number;
    severity: WorldPing["severity"];
    nodes: Array<{ name: string; ip?: string | null; inAlert?: boolean; severity?: WorldPing["severity"]; alertCount?: number }>;
  }>();

  (hosts || []).forEach((host: any, idx: number) => {
    const pos = hostLocation(host, idx);
    const key = `${pos.x.toFixed(4)}:${pos.y.toFixed(4)}`;
    const hostAlerts = alertMap.get(String(host.name || "").toLowerCase()) || [];
    const hostSeverity = hostAlerts.reduce<WorldPing["severity"]>((current, alert) => {
      const next = (alert.severity || "info").toLowerCase() as WorldPing["severity"];
      return severityRank[String(next)] > severityRank[String(current)] ? next : current;
    }, "healthy");

    if (!groups.has(key)) {
      groups.set(key, { x: pos.x, y: pos.y, severity: hostSeverity, nodes: [] });
    }

    const group = groups.get(key)!;
    if (severityRank[String(hostSeverity)] > severityRank[String(group.severity)]) {
      group.severity = hostSeverity;
    }

    group.nodes.push({
      name: host.name,
      ip: host.ip_address || null,
      inAlert: hostAlerts.length > 0,
      severity: hostAlerts.length > 0 ? hostSeverity : "healthy",
      alertCount: hostAlerts.length,
    });
  });

  return [...groups.entries()].map(([key, group]) => {
    const alertingNodes = group.nodes.filter((node) => node.inAlert).length;
    return {
      id: key,
      label: group.nodes.length === 1 ? group.nodes[0].name : `${group.nodes.length} nodes`,
      x: group.x,
      y: group.y,
      severity: group.severity,
      meta: alertingNodes > 0 ? `${alertingNodes} in alert` : "Healthy",
      nodes: group.nodes.sort((a, b) => {
        const sevDiff = severityRank[String(b.severity || "healthy")] - severityRank[String(a.severity || "healthy")];
        return sevDiff !== 0 ? sevDiff : a.name.localeCompare(b.name);
      }),
    };
  });
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "critical" | "warning" | "info" | "neutral" }) {
  const tones = {
    critical: "border-red-500/30 bg-red-950/70 text-red-100",
    warning: "border-amber-500/30 bg-amber-950/70 text-amber-100",
    info: "border-sky-500/30 bg-sky-950/70 text-sky-100",
    neutral: "border-border bg-card text-foreground",
  } as const;
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-xs uppercase tracking-wide opacity-90">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-none">{value}</div>
    </div>
  );
}

function MapCard({ pings, mode, onPanel, onTheater, onCollapse }: { pings: WorldPing[]; mode: "card" | "panel" | "theater"; onPanel: () => void; onTheater: () => void; onCollapse: () => void }) {
  const mapHeight = mode === "theater" ? "h-[68vh]" : mode === "panel" ? "h-[46vh]" : "h-[240px]";
  return (
    <div className={`rounded-xl border border-border bg-card p-3 ${mode !== "card" ? "shadow-2xl" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Global alert map</div>
          <div className="text-xs text-muted-foreground">Ping visibility before the wall of pain below.</div>
        </div>
        <div className="flex items-center gap-2">
          {mode !== "card" ? <Button variant="outline" size="sm" onClick={onCollapse}><Shrink className="h-4 w-4" /> Collapse</Button> : <Button variant="outline" size="sm" onClick={onPanel}><Expand className="h-4 w-4" /> Panel</Button>}
          {mode !== "theater" && <Button variant="outline" size="sm" onClick={onTheater}><MonitorUp className="h-4 w-4" /> Theater</Button>}
        </div>
      </div>
      <WorldMap pings={pings} className={mapHeight} dense={mode === "theater"} />
    </div>
  );
}

function AlertWall({ alerts, selectedSeverity, setSelectedSeverity, groupMode, setGroupMode, onOpenActions, onOpenHost, onTheater, theater }: any) {
  const filtered = useMemo(() => alerts.filter((alert: any) => selectedSeverity === "all" ? true : (alert.severity || "info").toLowerCase() === selectedSeverity), [alerts, selectedSeverity]);
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const alert of filtered) {
      const key = groupMode === "severity" ? (alert.severity || "info") : alertGroup(alert);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(alert);
    }
    return [...map.entries()];
  }, [filtered, groupMode]);

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="border-b border-border/70 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Active alerts</h2>
            <p className="mt-1 text-xs text-muted-foreground">All actions live here. Ack notes are optional, not theatre.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {["all", "critical", "warning", "info"].map((severity) => (
              <button key={severity} onClick={() => setSelectedSeverity(severity)} className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${selectedSeverity === severity ? 'bg-primary text-primary-foreground' : 'border border-border bg-background/70 text-muted-foreground hover:text-foreground'}`}>{severity}</button>
            ))}
            <button onClick={() => setGroupMode(groupMode === 'host' ? 'severity' : 'host')} className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground">
              Group: {groupMode}
            </button>
            <button onClick={onTheater} className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground">
              {theater ? 'Collapse alerts' : 'Theater view'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {groups.length === 0 && <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">No active alerts. The universe is briefly behaving.</div>}
        {groups.map(([group, items]) => (
          <section key={group} className="space-y-2">
            <div className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{group} · {items.length}</div>
            <div className="space-y-3">
              {items.sort((a: any, b: any) => severityOrder.indexOf((a.severity || 'info').toLowerCase() as any) - severityOrder.indexOf((b.severity || 'info').toLowerCase() as any)).map((alert: any) => {
                const meta = severityMeta(alert.severity);
                const Icon = meta.icon;
                return (
                  <div key={alert.id} className={`rounded-2xl border shadow-sm overflow-hidden ${meta.panel}`}>
                    <div className="flex">
                      <div className={`w-1.5 shrink-0 ${meta.bar}`} />
                      <div className="flex-1 px-4 py-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Icon className={`h-4 w-4 ${meta.text}`} />
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${meta.pill}`}>{alert.severity || 'info'}</span>
                              {alert.acknowledged && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Acked</span>}
                              {alert.service && <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/90">{alert.service}</span>}
                              {alert.host && <button type="button" onClick={() => onOpenHost(alert.host)} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/90 transition hover:bg-black/35 hover:text-white">{alert.host}</button>}
                            </div>
                            <div className="mt-2 text-[15px] font-semibold leading-6 text-white">{alert.message || 'Untitled alert'}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/70">
                              <span>Opened {relativeTime(alert.first_fired_at || alert.created_at)}</span>
                              <span>Last seen {relativeTime(alert.last_fired_at || alert.created_at)}</span>
                              {Number(alert.occurrence_count || 1) > 1 && <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/90">{alert.occurrence_count}x fired</span>}
                              {alert.acknowledged_by && <span>Ack by {alert.acknowledged_by}</span>}
                              {alert.acknowledgment_reason && <span className="text-white/85">Reason: {alert.acknowledgment_reason}</span>}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button size="sm" variant="secondary" onClick={() => onOpenActions(alert)}>Actions</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const qc = useQueryClient();
  const workspaceId = getWorkspaceId();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [groupMode, setGroupMode] = useState<'host' | 'severity'>('host');
  const [mapMode, setMapMode] = useState<"card" | "panel" | "theater">("card");
  const [alertsTheater, setAlertsTheater] = useState(false);
  const [ackDrafts, setAckDrafts] = useState<Record<string, string>>({});
  const [resolveDrafts, setResolveDrafts] = useState<Record<string, string>>({});
  const [silenceMinutes, setSilenceMinutes] = useState<Record<string, string>>({});
  const [actionAlert, setActionAlert] = useState<any | null>(null);
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setClockTick((tick) => tick + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['overview-alert-board'],
    queryFn: () => api.listAlerts({ resolved: false }),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ['overview-incidents-banner'],
    queryFn: api.overviewRecentIncidents,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const { data: hostsResponse } = useQuery({
    queryKey: ['overview-host-locations'],
    queryFn: () => api.listHosts({ limit: 500, offset: 0 }),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const ackMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.acknowledgeAlert(id, reason),
    onSuccess: (_data, variables) => {
      setAckDrafts((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ['overview-alert-board'] });
      setActionAlert(null);
      toast.success('Alert acknowledged');
    }
  });
  const resolveMutation = useMutation({ mutationFn: ({ id, message }: { id: string; message: string }) => api.resolveAlert(id, message), onSuccess: (_data, variables) => { qc.invalidateQueries({ queryKey: ['overview-alert-board'] }); setResolveDrafts((current) => { const next = { ...current }; delete next[variables.id]; return next; }); setActionAlert(null); toast.success('Alert resolved'); } });
  const bulkAckMutation = useMutation({ mutationFn: () => api.bulkAcknowledgeAlerts(selectedAlertIds, bulkAckReason), onSuccess: () => { qc.invalidateQueries({ queryKey: ['overview-alert-board'] }); setSelectedAlertIds([]); setBulkAckReason(''); toast.success('Selected alerts acknowledged'); } });
  const bulkResolveMutation = useMutation({ mutationFn: () => api.bulkResolveAlerts(selectedAlertIds, bulkResolveMessage), onSuccess: () => { qc.invalidateQueries({ queryKey: ['overview-alert-board'] }); setSelectedAlertIds([]); setBulkResolveMessage(''); toast.success('Selected alerts resolved'); } });
  const silenceMutation = useMutation({
    mutationFn: ({ alert, minutes }: { alert: any; minutes: number }) => api.createSilence({
      workspace_id: workspaceId,
      name: `Silence: ${alert.host || alert.service || 'alert'}`,
      matcher: { ...(alert.host ? { host: alert.host } : {}), ...(alert.service ? { service: alert.service } : {}), ...(alert.severity ? { severity: alert.severity } : {}) },
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      reason: alert.message || 'Silenced from overview wall',
    }),
    onSuccess: (_data, variables) => { setSilenceMinutes((current) => { const next = { ...current }; delete next[variables.alert.id]; return next; }); setActionAlert(null); toast.success('Silence created'); },
    onError: (e: any) => toast.error(e.message || 'Failed to create silence'),
  });

  const severityMutation = useMutation({
    mutationFn: ({ id, severity }: { id: string; severity: string }) => api.updateAlertSeverity(id, severity),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overview-alert-board'] }); setActionAlert(null); toast.success('Alert severity updated'); },
    onError: (e: any) => toast.error(e.message || 'Failed to update severity'),
  });

  const grouped = useMemo(() => ({
    critical: alerts.filter((a: any) => (a.severity || '').toLowerCase() === 'critical'),
    warning: alerts.filter((a: any) => (a.severity || '').toLowerCase() === 'warning'),
    info: alerts.filter((a: any) => (a.severity || '').toLowerCase() === 'info'),
  }), [alerts]);
  const repeatBursts = useMemo(() => totalExtraOccurrences(alerts), [alerts]);

  const hosts = useMemo(() => ((hostsResponse?.items || []) as any[]), [hostsResponse]);
  const hostsByName = useMemo(() => Object.fromEntries(hosts.map((host: any) => [String(host.name || '').toLowerCase(), host])), [hosts]);
  const pings = useMemo(() => buildLocationPings(alerts, hosts), [alerts, hosts]);

  return (
    <motion.div className="space-y-6 p-4 sm:p-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Overview" description="Alert wall with map context, fast actions, and big-screen modes" />
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <SummaryCard label="Critical" value={grouped.critical.length} tone="critical" />
        <SummaryCard label="Warning" value={grouped.warning.length} tone="warning" />
        <SummaryCard label="Info" value={grouped.info.length} tone="info" />
        <SummaryCard label="Active groups" value={alerts.length} tone="neutral" />
        <SummaryCard label="Repeat firings" value={repeatBursts} tone="neutral" />
      </motion.div>

      {incidents.length > 0 && (
        <motion.div variants={item}>
          <div className="overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-r from-red-950/90 via-red-900/70 to-amber-950/80 shadow-sm">
            <div className="px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-100">
                  <AlertTriangle className="h-3.5 w-3.5" /> Active incidents
                </span>
                <span className="text-xs text-red-100/80">{incidents.length} live</span>
              </div>
              <div className="mt-3 grid gap-2 xl:grid-cols-3">
                {incidents.slice(0, 3).map((inc: any) => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => (window.location.href = '/incidents')}
                    className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-left backdrop-blur-sm transition hover:bg-black/25"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-red-100/70">{inc.ref}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${inc.severity === 'critical' ? 'bg-red-500 text-white' : inc.severity === 'warning' ? 'bg-amber-400 text-black' : 'bg-sky-500 text-white'}`}>{inc.severity}</span>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-white">{inc.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-red-100/75">
                      <span>{relativeTime(inc.started_at)}</span>
                      {inc.assigned_user?.name && <span>{inc.assigned_user.name}</span>}
                      {(inc.affected_hosts || []).length > 0 && <span>{inc.affected_hosts.length} host{inc.affected_hosts.length === 1 ? '' : 's'}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {!alertsTheater && (
        <motion.div variants={item} className={mapMode === "theater" ? "space-y-4" : undefined}>
          <MapCard pings={pings} mode={mapMode} onPanel={() => setMapMode("panel")} onTheater={() => setMapMode("theater")} onCollapse={() => setMapMode("card")} />
        </motion.div>
      )}

      <motion.div variants={item} className={alertsTheater ? "min-h-[70vh]" : mapMode === "theater" ? "mt-2" : undefined}>
        {isLoading ? <div className="rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Loading alerts…</div> : (
          <AlertWall
            alerts={alerts}
            selectedSeverity={selectedSeverity}
            setSelectedSeverity={setSelectedSeverity}
            groupMode={groupMode}
            setGroupMode={setGroupMode}
            onOpenActions={(alert: any) => setActionAlert(alert)}
            onOpenHost={(hostName: string) => {
              const host = hostsByName[String(hostName || '').toLowerCase()];
              if (!host?.id) return toast.error('Host details unavailable');
              setSelectedHostId(host.id);
            }}
            onTheater={() => setAlertsTheater((current) => !current)}
            theater={alertsTheater}
          />
        )}
      </motion.div>

      <HostDetailModal hostId={selectedHostId} variant="detailed" onClose={() => setSelectedHostId(null)} />

      <Dialog open={!!actionAlert} onOpenChange={(open) => !open && setActionAlert(null)}>
        <DialogContent className="border-border bg-background sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Alert actions</DialogTitle>
            <DialogDescription>
              {actionAlert ? `${actionAlert.host || actionAlert.service || 'Alert'} · ${actionAlert.message || 'Untitled alert'}` : 'Choose what to do with this alert.'}
            </DialogDescription>
          </DialogHeader>

          {actionAlert && (
            <div className="space-y-5">
              {!actionAlert.acknowledged && (
                <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                  <label className="text-sm font-medium">Acknowledge</label>
                  <Input
                    value={ackDrafts[actionAlert.id] || ''}
                    onChange={(e) => setAckDrafts((current) => ({ ...current, [actionAlert.id]: e.target.value }))}
                    placeholder="Optional ack reason"
                  />
                  <div className="flex justify-end">
                    <Button disabled={ackMutation.isPending} onClick={() => ackMutation.mutate({ id: actionAlert.id, reason: ackDrafts[actionAlert.id] || '' })}>
                      <Eye className="h-4 w-4" /> Ack alert
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <label className="text-sm font-medium">Change severity</label>
                <div className="grid grid-cols-3 gap-2">
                  {['info', 'warning', 'critical'].map((severity) => (
                    <Button key={severity} variant={actionAlert.severity === severity ? 'default' : 'outline'} onClick={() => severityMutation.mutate({ id: actionAlert.id, severity })}>
                      {severity}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <label className="text-sm font-medium">Silence duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 60, 240, 1440].map((minutes) => (
                    <Button key={minutes} variant="outline" onClick={() => workspaceId ? silenceMutation.mutate({ alert: actionAlert, minutes }) : toast.error('No workspace selected')}>
                      {minutes >= 1440 ? '1 day' : minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={silenceMinutes[actionAlert.id] || ''}
                    onChange={(e) => setSilenceMinutes((current) => ({ ...current, [actionAlert.id]: e.target.value }))}
                    placeholder="Custom minutes"
                  />
                  <Button variant="outline" onClick={() => {
                    const minutes = Number(silenceMinutes[actionAlert.id] || '0');
                    if (!minutes || minutes < 1) return toast.error('Enter silence minutes');
                    if (!workspaceId) return toast.error('No workspace selected');
                    silenceMutation.mutate({ alert: actionAlert, minutes });
                  }}>
                    <ShieldAlert className="h-4 w-4" /> Silence
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <label className="text-sm font-medium">Resolve</label>
                <Input
                  value={resolveDrafts[actionAlert.id] || ''}
                  onChange={(e) => setResolveDrafts((current) => ({ ...current, [actionAlert.id]: e.target.value }))}
                  placeholder="Required resolution message"
                />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => {
                    const message = (resolveDrafts[actionAlert.id] || '').trim();
                    if (!message) return toast.error('Resolution message is required');
                    resolveMutation.mutate({ id: actionAlert.id, message });
                  }}>
                    <CheckCircle2 className="h-4 w-4" /> Resolve alert
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setActionAlert(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>
  );
}
