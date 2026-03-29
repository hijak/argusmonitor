import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getWorkspaceId } from "@/lib/workspace";
import { PageHeader } from "@/components/PageHeader";
import { BarChart3, Calendar, Download, FileSpreadsheet, Loader2, Package, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const REPORT_TYPES = [
  { value: "soc2-summary", label: "SOC 2 summary", description: "Audit events, alert volume, and service health snapshot" },
  { value: "ops-weekly", label: "Ops weekly", description: "Operational summary for the last 7 days" },
  { value: "incident-posture", label: "Incident posture", description: "Alert-heavy view for reliability reviews" },
];

const EXPORT_TYPES = [
  { value: "audit-log", label: "Audit log" },
  { value: "alerts", label: "Alerts" },
  { value: "services", label: "Services" },
];

const RANGE_PRESETS = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

function isoLocal(date: Date) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

function rangePreset(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { period_start: isoLocal(start), period_end: isoLocal(end) };
}

function prettyDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function SummaryChip({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">{label}: <span className="font-medium text-foreground">{value}</span></div>;
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const workspaceId = getWorkspaceId();
  const [reportForm, setReportForm] = useState({ report_type: "soc2-summary", ...rangePreset(7) });
  const [exportForm, setExportForm] = useState({ export_type: "audit-log", format: "json" });

  const { data: complianceReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["reports-page-compliance", workspaceId],
    queryFn: () => api.listComplianceReports(workspaceId!),
    enabled: !!workspaceId,
  });

  const { data: exports = [], isLoading: exportsLoading } = useQuery({
    queryKey: ["reports-page-exports", workspaceId],
    queryFn: () => api.listExports(workspaceId!),
    enabled: !!workspaceId,
  });

  const createReport = useMutation({
    mutationFn: () => api.createComplianceReport({ ...reportForm, workspace_id: workspaceId }),
    onSuccess: () => {
      toast.success("Report generated");
      qc.invalidateQueries({ queryKey: ["reports-page-compliance", workspaceId] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to generate report"),
  });

  const createExport = useMutation({
    mutationFn: () => api.createExport({ ...exportForm, workspace_id: workspaceId, filters: { generated_from: "reports-page" } }),
    onSuccess: () => {
      toast.success("Export created");
      qc.invalidateQueries({ queryKey: ["reports-page-exports", workspaceId] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create export"),
  });

  const totals = useMemo(() => ({
    reports: complianceReports.length,
    exports: exports.length,
    completedReports: complianceReports.filter((r: any) => r.status === "completed").length,
  }), [complianceReports, exports]);

  const latestReport = complianceReports[0];

  const download = async (url: string | null | undefined, fallbackName: string) => {
    if (!url) {
      toast.error("No download available yet");
      return;
    }
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("argus_token") || ""}`,
        "X-Workspace-Id": workspaceId || "",
      },
    });
    if (!res.ok) {
      toast.error("Download failed");
      return;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fallbackName;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  if (!workspaceId) {
    return <div className="p-6 text-sm text-muted-foreground">No workspace selected.</div>;
  }

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Reports" description="Generate operational reports and exports for the current workspace" />
      </motion.div>

      <motion.div variants={item} className="grid gap-4 md:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Reports" value={totals.reports} />
        <StatCard icon={Package} label="Exports" value={totals.exports} />
        <StatCard icon={BarChart3} label="Completed" value={totals.completedReports} />
        <StatCard icon={Sparkles} label="Latest report" value={latestReport ? latestReport.report_type : "—"} compact />
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <motion.div variants={item} className="rounded-lg border border-border bg-card p-5 space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Generate compliance report</h2>
              <p className="mt-1 text-xs text-muted-foreground">Use presets for sensible report types and date windows instead of typing magic strings.</p>
            </div>

            <div className="grid gap-2">
              {REPORT_TYPES.map((type) => (
                <button key={type.value} type="button" onClick={() => setReportForm((f) => ({ ...f, report_type: type.value }))}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${reportForm.report_type === type.value ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-surface-hover"}`}>
                  <div className="text-sm font-medium">{type.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{type.description}</div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {RANGE_PRESETS.map((preset) => (
                <button key={preset.label} type="button" onClick={() => setReportForm((f) => ({ ...f, ...rangePreset(preset.days) }))}
                  className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                  Last {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Period start</label>
                <input type="datetime-local" value={reportForm.period_start} onChange={(e) => setReportForm((f) => ({ ...f, period_start: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Period end</label>
                <input type="datetime-local" value={reportForm.period_end} onChange={(e) => setReportForm((f) => ({ ...f, period_end: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25" />
              </div>
            </div>

            <button onClick={() => createReport.mutate()} disabled={createReport.isPending}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {createReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />} Generate report
            </button>
          </section>

          <section className="space-y-3 border-t border-border pt-5">
            <div>
              <h2 className="text-sm font-semibold">Create data export</h2>
              <p className="mt-1 text-xs text-muted-foreground">Quick exports for audit, alert, or service records.</p>
            </div>
            <div className="grid gap-2">
              {EXPORT_TYPES.map((type) => (
                <button key={type.value} type="button" onClick={() => setExportForm((f) => ({ ...f, export_type: type.value }))}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${exportForm.export_type === type.value ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-surface-hover"}`}>
                  <div className="text-sm font-medium">{type.label}</div>
                </button>
              ))}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Format</label>
              <Select value={exportForm.format} onValueChange={(value) => setExportForm((f) => ({ ...f, format: value }))}>
                <SelectTrigger className="w-full rounded-lg border-border bg-surface text-sm focus:ring-primary/25">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <button onClick={() => createExport.mutate()} disabled={createExport.isPending}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50">
              {createExport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Create export
            </button>
          </section>
        </motion.div>

        <div className="space-y-6">
          <motion.div variants={item} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Compliance reports</h2>
            </div>
            <div className="divide-y divide-border">
              {reportsLoading ? <EmptyRow label="Loading reports…" /> : complianceReports.map((r: any) => (
                <div key={r.id} className="space-y-3 px-5 py-4">
                  <div className="flex items-start gap-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.report_type}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-2 py-0.5 uppercase tracking-wide">{r.status}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{prettyDate(r.generated_at)}</span>
                        <span>{new Date(r.period_start).toLocaleDateString()} → {new Date(r.period_end).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button onClick={() => download(r.download_url || `/api/enterprise/compliance-reports/${r.id}/download`, `${r.report_type}-${r.id}.json`)}
                      className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                      <Download className="h-3 w-3" /> Download
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-8">
                    <SummaryChip label="Audit events" value={r.summary?.audit_events ?? 0} />
                    <SummaryChip label="Alerts" value={r.summary?.alerts ?? 0} />
                    <SummaryChip label="Services" value={r.summary?.services_total ?? 0} />
                    <SummaryChip label="Down/degraded" value={r.summary?.services_down_or_degraded ?? 0} />
                    <SummaryChip label="Window" value={`${r.summary?.window_days ?? 0}d`} />
                  </div>
                </div>
              ))}
              {!reportsLoading && !complianceReports.length && <EmptyRow label="No compliance reports yet." />}
            </div>
          </motion.div>

          <motion.div variants={item} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">Data exports</h2>
            </div>
            <div className="divide-y divide-border">
              {exportsLoading ? <EmptyRow label="Loading exports…" /> : exports.map((x: any) => (
                <div key={x.id} className="space-y-2 px-5 py-4">
                  <div className="flex items-center gap-4">
                    <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{x.export_type}.{x.format}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-2 py-0.5 uppercase tracking-wide">{x.status}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{prettyDate(x.generated_at)}</span>
                      </div>
                    </div>
                    <button onClick={() => download(x.download_url || `/api/enterprise/exports/${x.id}/download`, `${x.export_type}-${x.id}.${x.format || "json"}`)}
                      className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                      <Download className="h-3 w-3" /> Download
                    </button>
                  </div>
                  <div className="pl-8 text-xs text-muted-foreground">Filters: {JSON.stringify(x.filters || {})}</div>
                </div>
              ))}
              {!exportsLoading && !exports.length && <EmptyRow label="No exports yet." />}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, compact = false }: { icon: any; label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`mt-1 font-semibold ${compact ? "truncate text-base" : "text-2xl"}`}>{value}</div>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="px-5 py-8 text-sm text-muted-foreground">{label}</div>;
}
