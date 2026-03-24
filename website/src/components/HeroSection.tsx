import { Button } from "@/components/ui/button";
import {
  Github,
  Activity,
  Bot,
  AlertTriangle,
  CheckCircle2,
  Server,
  Globe,
  Bell,
  LayoutDashboard,
  FileText,
  BarChart3,
  Cpu,
  HardDrive,
  MemoryStick,
  Zap,
  Building2,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { motion } from "framer-motion";
import { APP_URL, DEMO_URL, GITHUB_URL, PLUGIN_DIRECTORY_URL, START_URL } from "@/lib/site";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } }),
};

const MiniChart = ({ color, values }: { color: string; values: number[] }) => (
  <svg viewBox="0 0 100 28" className="h-8 w-full" preserveAspectRatio="none">
    <polyline
      fill="none"
      stroke={color}
      strokeWidth="2"
      points={values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - v * 0.22}`).join(" ")}
    />
  </svg>
);

const StatusBadge = ({ status }: { status: "healthy" | "warning" | "critical" | "info" }) => {
  const classes = {
    healthy: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20",
    warning: "bg-primary/12 text-primary border-primary/20",
    critical: "bg-destructive/12 text-destructive border-destructive/20",
    info: "bg-sky-500/12 text-sky-400 border-sky-500/20",
  };
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${classes[status]}`}>{status}</span>;
};

const MetricPill = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="rounded-md border border-border bg-background/70 p-3">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <div className="mt-2 text-lg font-semibold text-foreground">{value}</div>
  </div>
);

const DashboardPreview = () => {
  const hosts = [
    { name: "node01", ip: "10.13.37.41", status: "healthy" as const, cpu: 34, memory: 62, spark: [28, 32, 36, 31, 34, 38, 34] },
    { name: "node02", ip: "10.13.37.42", status: "healthy" as const, cpu: 18, memory: 41, spark: [14, 16, 18, 17, 19, 20, 18] },
    { name: "db-primary", ip: "10.13.37.67", status: "warning" as const, cpu: 87, memory: 78, spark: [52, 58, 62, 70, 80, 87, 79] },
  ];

  const navIcons = [Activity, Server, Globe, Zap, Bell, LayoutDashboard, FileText, BarChart3, Bot];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/90 shadow-2xl shadow-black/20 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <div>
          <div className="font-display text-sm font-semibold text-foreground">Overview</div>
          <div className="text-xs text-muted-foreground">System health at a glance</div>
        </div>
        <StatusBadge status="info" />
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 lg:hidden">
        {navIcons.map((Icon, i) => (
          <div
            key={i}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${i === 0 ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-[#221a16] text-muted-foreground"}`}
          >
            <Icon className="h-4 w-4" />
          </div>
        ))}
      </div>

      <div className="lg:grid lg:min-h-[430px] lg:grid-cols-[88px_1fr]">
        <div className="hidden border-r border-border bg-[#221a16] px-2 py-3 lg:block">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            {navIcons.map((Icon, i) => (
              <div
                key={i}
                className={`flex h-9 items-center justify-center rounded-lg border ${i === 0 ? "border-primary/20 bg-primary/10 text-primary" : "border-transparent text-muted-foreground"}`}
              >
                <Icon className="h-4 w-4" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-background/70">
          <div className="hidden items-center justify-between border-b border-border px-4 py-3 lg:flex">
            <div>
              <div className="font-display text-sm font-semibold text-foreground">Overview</div>
              <div className="text-xs text-muted-foreground">System health at a glance</div>
            </div>
            <StatusBadge status="info" />
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <MetricPill icon={Server} label="Hosts" value="12" />
                <MetricPill icon={Bell} label="Alerts" value="3" />
                <MetricPill icon={CheckCircle2} label="Health" value="96%" />
                <MetricPill icon={Zap} label="TX Success" value="99.4%" />
              </div>

              <div className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Host Health</h3>
                  <span className="text-[11px] text-muted-foreground">3 live agents</span>
                </div>
                <div className="divide-y divide-border">
                  {hosts.map((host) => (
                    <div key={host.name} className="px-4 py-3 text-xs">
                      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_72px_56px_56px_72px] sm:items-center sm:gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-mono text-sm text-foreground">{host.name}</span>
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                              <Activity className="h-2.5 w-2.5" /> Live
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{host.ip}</div>
                        </div>

                        <div className="sm:justify-self-start">
                          <StatusBadge status={host.status} />
                        </div>

                        <div className="flex items-center gap-4 sm:contents">
                          <span className={`${host.cpu > 80 ? "text-destructive" : "text-foreground"} font-mono sm:block`}>CPU {host.cpu}%</span>
                          <span className={`${host.memory > 75 ? "text-primary" : "text-foreground"} font-mono sm:block`}>MEM {host.memory}%</span>
                        </div>

                        <div className="pt-1 sm:pt-0">
                          <MiniChart color={host.status === "warning" ? "hsl(25 95% 53%)" : "hsl(160 84% 39%)"} values={host.spark} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Bell className="h-3.5 w-3.5 text-primary" /> Recent Alerts
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex flex-col gap-2 rounded-md border border-border bg-background/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                      db-primary: CPU above 85%
                    </div>
                    <StatusBadge status="warning" />
                  </div>
                  <div className="flex flex-col gap-2 rounded-md border border-border bg-background/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Transactions stable across monitored services
                    </div>
                    <StatusBadge status="healthy" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5 text-primary" /> CPU Trend
                </div>
                <MiniChart color="hsl(25 95% 53%)" values={[18, 22, 24, 31, 29, 35, 41, 38, 53, 71, 87, 68]} />
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <MemoryStick className="h-3.5 w-3.5 text-sky-400" /> Memory Trend
                </div>
                <MiniChart color="hsl(199 89% 48%)" values={[46, 48, 50, 51, 53, 55, 58, 60, 64, 68, 76, 74]} />
              </div>

              <div className="rounded-lg border border-sky-500/20 bg-card p-4 shadow-[0_0_32px_-18px_rgba(56,189,248,0.45)]">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-sky-400">
                  <Bot className="h-3.5 w-3.5" /> Argus Co-pilot
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3 text-xs text-muted-foreground">
                  <div className="mb-2 text-[11px] text-foreground">tell me about node01</div>
                  <div className="space-y-1.5 leading-relaxed">
                    <div>• Status: <span className="text-emerald-400">healthy</span></div>
                    <div>• IP: <span className="font-mono text-foreground">10.13.37.41</span></div>
                    <div>• CPU: <span className="font-mono text-foreground">34%</span></div>
                    <div>• Memory: <span className="font-mono text-foreground">62%</span></div>
                    <div>• Live agent connected</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricPill icon={HardDrive} label="Disk" value="71%" />
                <MetricPill icon={Globe} label="Services" value="18" />
                <MetricPill icon={Bot} label="AI" value="Live" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HeroSection = () => (
  <section className="relative overflow-hidden pb-20 pt-32 lg:pb-28 lg:pt-40">
    <div className="pointer-events-none absolute left-1/2 top-1/4 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />

    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6 text-center">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-mono text-muted-foreground backdrop-blur-sm">
            <Building2 className="h-3 w-3 text-primary" /> Enterprise foundations landing: workspaces • RBAC • OIDC • audit logs
          </span>
        </motion.div>

        <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible" className="text-4xl font-display font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Monitoring without <span className="text-gradient-amber">the bloat</span>, now with enterprise foundations.
        </motion.h1>

        <motion.p custom={2} variants={fadeUp} initial="hidden" animate="visible" className="mx-auto max-w-3xl text-lg leading-relaxed text-muted-foreground">
          Host monitoring, service discovery, alerts, dashboards, AI-assisted operations, and now an official plugin directory for collectors and UI integrations — all moving toward serious buyer readiness with workspaces, RBAC, OIDC SSO, audit logs, maintenance windows, silences, and real notification delivery.
        </motion.p>

        <motion.div custom={3} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild variant="hero" size="lg"><a href={START_URL} target="_blank" rel="noreferrer">Start Free</a></Button>
          <Button asChild variant="hero-outline" size="lg"><a href={DEMO_URL}>Book Demo</a></Button>
          <Button asChild variant="secondary" size="lg"><a href={APP_URL} target="_blank" rel="noreferrer">Open App</a></Button>
          <Button asChild variant="secondary" size="lg"><a href={PLUGIN_DIRECTORY_URL} target="_blank" rel="noreferrer">Browse Plugins</a></Button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
            <Github className="h-4 w-4" /> View on GitHub
          </a>
        </motion.div>

        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><KeyRound className="h-3.5 w-3.5 text-primary" /> OIDC SSO foundation</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Audit logs + RBAC</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><Bell className="h-3.5 w-3.5 text-primary" /> Real email / Slack / webhook delivery</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1"><Globe className="h-3.5 w-3.5 text-primary" /> Official plugin directory</span>
        </motion.div>
      </div>

      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="mx-auto mt-14 max-w-6xl">
        <div className="rounded-2xl border border-border bg-card/30 p-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-sm glow-amber-subtle">
          <DashboardPreview />
        </div>
      </motion.div>
    </div>
  </section>
);

export default HeroSection;
