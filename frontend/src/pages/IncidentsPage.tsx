import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle, Clock, CheckCircle, MessageSquare, Bot, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const incidents = [
  {
    id: "INC-2024-042",
    title: "Elevated error rates on API endpoints",
    status: "investigating",
    severity: "warning" as const,
    started: "2024-01-15 14:32 UTC",
    duration: "23 min",
    affected: ["api-prod-01", "api-prod-02"],
    timeline: [
      { time: "14:32", event: "Alert triggered: Error rate > 5% on /api/orders", type: "alert" },
      { time: "14:33", event: "Incident created automatically", type: "system" },
      { time: "14:35", event: "AI Analysis: Spike correlates with deployment v2.4.1 at 14:30", type: "ai" },
      { time: "14:38", event: "Assigned to On-Call: Alice Chen", type: "action" },
      { time: "14:42", event: "Root cause identified: Database connection pool exhaustion", type: "action" },
      { time: "14:48", event: "Mitigation: Increased connection pool size to 200", type: "action" },
      { time: "14:55", event: "Error rates returning to normal", type: "system" },
    ],
  },
  {
    id: "INC-2024-041",
    title: "Worker pool saturation causing job delays",
    status: "identified",
    severity: "critical" as const,
    started: "2024-01-15 13:47 UTC",
    duration: "1h 8min",
    affected: ["worker-03"],
    timeline: [
      { time: "13:47", event: "Alert triggered: CPU > 90% on worker-03", type: "alert" },
      { time: "13:48", event: "Incident created automatically", type: "system" },
      { time: "13:50", event: "AI Analysis: Worker processing backlog of 15,000 jobs", type: "ai" },
      { time: "13:55", event: "Assigned to On-Call: Bob Martinez", type: "action" },
      { time: "14:10", event: "Horizontal scaling initiated: 2 additional workers", type: "action" },
    ],
  },
];

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

export default function IncidentsPage() {
  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Incidents" description="Active and recent incident timelines" />
      </motion.div>

      {incidents.map(inc => (
        <motion.div key={inc.id} variants={item} className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{inc.id}</span>
                <StatusBadge variant={inc.severity} pulse>{inc.severity}</StatusBadge>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{inc.status}</span>
              </div>
              <h3 className="mt-1 text-sm font-medium">{inc.title}</h3>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{inc.duration}</div>
              <p className="mt-0.5">{inc.started}</p>
            </div>
          </div>

          {/* Affected */}
          <div className="border-b border-border px-5 py-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Affected:</span>
            {inc.affected.map(h => (
              <span key={h} className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{h}</span>
            ))}
          </div>

          {/* Timeline */}
          <div className="px-5 py-4">
            <div className="space-y-0">
              {inc.timeline.map((event, i) => (
                <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < inc.timeline.length - 1 && (
                    <div className="absolute left-[11px] top-[24px] h-[calc(100%-8px)] w-px bg-border" />
                  )}
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${typeBg[event.type]}`}>
                    {event.type === "alert" && <AlertTriangle className={`h-3 w-3 ${typeColors[event.type]}`} />}
                    {event.type === "system" && <ArrowRight className={`h-3 w-3 ${typeColors[event.type]}`} />}
                    {event.type === "ai" && <Bot className={`h-3 w-3 ${typeColors[event.type]}`} />}
                    {event.type === "action" && <CheckCircle className={`h-3 w-3 ${typeColors[event.type]}`} />}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className={`text-sm ${event.type === "ai" ? "text-primary" : ""}`}>{event.event}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground pt-0.5">{event.time}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
