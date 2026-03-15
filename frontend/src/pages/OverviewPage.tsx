import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Sparkline } from "@/components/Sparkline";
import { PageHeader } from "@/components/PageHeader";
import { Server, Bell, AlertTriangle, Zap, CheckCircle, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";

const hostData = [
  { name: "api-prod-01", status: "healthy" as const, cpu: 34, mem: 62, uptime: "99.98%", spark: [45, 42, 38, 35, 34, 36, 34] },
  { name: "api-prod-02", status: "healthy" as const, cpu: 28, mem: 55, uptime: "99.99%", spark: [30, 32, 28, 27, 29, 28, 28] },
  { name: "db-primary", status: "warning" as const, cpu: 78, mem: 85, uptime: "99.95%", spark: [60, 65, 70, 72, 75, 78, 78] },
  { name: "web-prod-01", status: "healthy" as const, cpu: 22, mem: 41, uptime: "100%", spark: [20, 22, 21, 23, 22, 22, 22] },
  { name: "cache-01", status: "healthy" as const, cpu: 15, mem: 72, uptime: "99.99%", spark: [14, 15, 16, 15, 14, 15, 15] },
  { name: "worker-03", status: "critical" as const, cpu: 95, mem: 92, uptime: "98.5%", spark: [70, 75, 80, 85, 90, 93, 95] },
  { name: "lb-prod-01", status: "healthy" as const, cpu: 8, mem: 22, uptime: "100%", spark: [7, 8, 9, 8, 7, 8, 8] },
  { name: "monitor-01", status: "healthy" as const, cpu: 42, mem: 58, uptime: "99.99%", spark: [40, 41, 43, 42, 41, 42, 42] },
];

const recentAlerts = [
  { id: 1, message: "High CPU on worker-03", severity: "critical" as const, time: "2 min ago", service: "Worker Pool" },
  { id: 2, message: "DB replication lag > 5s", severity: "warning" as const, time: "15 min ago", service: "Database" },
  { id: 3, message: "SSL certificate expiring in 7 days", severity: "warning" as const, time: "1 hour ago", service: "API Gateway" },
  { id: 4, message: "Transaction 'Checkout' failed", severity: "critical" as const, time: "3 hours ago", service: "E-Commerce" },
];

const recentIncidents = [
  { id: 1, title: "Elevated error rates on API", status: "investigating", duration: "23 min", severity: "warning" as const },
  { id: 2, title: "Worker pool saturation", status: "identified", duration: "45 min", severity: "critical" as const },
];

const transactions = [
  { name: "User Login", success: 99.2, avgTime: "1.2s", status: "healthy" as const },
  { name: "Checkout Flow", success: 97.8, avgTime: "3.4s", status: "warning" as const },
  { name: "API Auth", success: 99.9, avgTime: "0.3s", status: "healthy" as const },
  { name: "Report Export", success: 94.1, avgTime: "8.2s", status: "critical" as const },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.15 } } };

export default function OverviewPage() {
  return (
    <motion.div className="p-6 space-y-6" variants={container} initial="hidden" animate="show">
      <motion.div variants={item}>
        <PageHeader title="Overview" description="System health at a glance">
          <StatusBadge variant="healthy" pulse>All systems operational</StatusBadge>
        </PageHeader>
      </motion.div>

      {/* Key Metrics */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Monitored Hosts" value={142} change="+3 this week" changeType="positive" icon={<Server className="h-4 w-4" />} />
        <MetricCard label="Active Alerts" value={7} change="+2 from yesterday" changeType="negative" icon={<Bell className="h-4 w-4" />} />
        <MetricCard label="Health Score" value="96.4%" change="-0.3%" changeType="negative" icon={<CheckCircle className="h-4 w-4" />} />
        <MetricCard label="Transaction Success" value="98.1%" change="+0.5%" changeType="positive" icon={<Zap className="h-4 w-4" />} />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Host Health Grid */}
        <motion.div variants={item} className="lg:col-span-2">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-medium">Host Health</h2>
              <span className="text-xs text-muted-foreground">{hostData.length} hosts</span>
            </div>
            <div className="divide-y divide-border">
              {hostData.map(host => (
                <div key={host.name} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-hover">
                  <StatusBadge variant={host.status}>{host.status}</StatusBadge>
                  <span className="flex-1 font-mono text-sm">{host.name}</span>
                  <div className="hidden items-center gap-6 text-xs text-muted-foreground sm:flex">
                    <span>CPU {host.cpu}%</span>
                    <span>MEM {host.mem}%</span>
                    <span>{host.uptime}</span>
                  </div>
                  <Sparkline
                    data={host.spark}
                    color={host.status === "critical" ? "hsl(0 84% 60%)" : host.status === "warning" ? "hsl(38 92% 50%)" : "hsl(160 84% 39%)"}
                    width={80}
                    height={24}
                  />
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Active Incidents */}
          <motion.div variants={item}>
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-medium">Active Incidents</h2>
                <span className="text-xs text-muted-foreground">{recentIncidents.length}</span>
              </div>
              <div className="divide-y divide-border">
                {recentIncidents.map(inc => (
                  <div key={inc.id} className="px-5 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{inc.title}</span>
                      <StatusBadge variant={inc.severity}>{inc.severity}</StatusBadge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="capitalize">{inc.status}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{inc.duration}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Transaction Success */}
          <motion.div variants={item}>
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-medium">Transactions</h2>
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="divide-y divide-border">
                {transactions.map(tx => (
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

      {/* Recent Alerts */}
      <motion.div variants={item}>
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium">Recent Alerts</h2>
            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {recentAlerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-hover">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.severity === "critical" ? "text-critical" : "text-warning"}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{alert.message}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{alert.service}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.time}</span>
                <StatusBadge variant={alert.severity}>{alert.severity}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
