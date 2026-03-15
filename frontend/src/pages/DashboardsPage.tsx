import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Plus, LayoutDashboard, Bot, Clock, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function DashboardsPage() {
  const navigate = useNavigate();
  const { data: dashboards = [] } = useQuery({
    queryKey: ["dashboards"],
    queryFn: api.listDashboards,
  });

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Dashboards" description="Custom and AI-generated dashboards">
          <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Dashboard
          </button>
        </PageHeader>
      </motion.div>

      <motion.div variants={item}>
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
          <Bot className="h-5 w-5 text-primary" />
          <input
            placeholder="Describe a dashboard... e.g. 'Create a dashboard showing API latency and error rates for the past 24 hours'"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Generate</button>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((db: any) => (
          <div
            key={db.id}
            onClick={() => navigate(`/dashboards/${db.id}`)}
            className="rounded-lg border border-border bg-card p-5 transition-colors hover:bg-surface-hover cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <LayoutDashboard className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              {db.type === "ai" && (
                <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Bot className="h-2.5 w-2.5" /> AI Generated
                </span>
              )}
              {db.type === "system" && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">System</span>
              )}
            </div>
            <h3 className="text-sm font-medium mb-1">{db.name}</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />{db.widgets_count} widgets</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(db.updated_at)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 rounded-sm bg-muted/50 group-hover:bg-primary/10 transition-colors" />
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
