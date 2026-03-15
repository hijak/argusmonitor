import { PageHeader } from "@/components/PageHeader";
import { BarChart3, Calendar, Download, TrendingUp, Clock } from "lucide-react";
import { motion } from "framer-motion";

const reports = [
  { name: "Weekly SLA Report", type: "Availability", generated: "Jan 15, 2024", period: "Jan 8-15" },
  { name: "Incident Summary", type: "Incidents", generated: "Jan 15, 2024", period: "Jan 1-15" },
  { name: "Performance Trends", type: "Performance", generated: "Jan 14, 2024", period: "Dec 15 - Jan 14" },
  { name: "Capacity Planning", type: "Infrastructure", generated: "Jan 13, 2024", period: "Q4 2023" },
  { name: "Transaction Health", type: "Transactions", generated: "Jan 12, 2024", period: "Jan 5-12" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function ReportsPage() {
  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Reports" description="Scheduled and on-demand reports">
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <BarChart3 className="h-4 w-4" />
            Generate Report
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item} className="rounded-lg border border-border bg-card">
        <div className="divide-y divide-border">
          {reports.map(r => (
            <div key={r.name} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-hover transition-colors cursor-pointer">
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{r.type}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.period}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.generated}</span>
                </div>
              </div>
              <button className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                <Download className="h-3 w-3" />
                Export
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
