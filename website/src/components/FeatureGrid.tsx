import { motion } from "framer-motion";
import { Cpu, Search, Bell, Bot, ShieldCheck, LayoutDashboard, FileText, Cog, Building2, KeyRound, ScrollText, CalendarClock } from "lucide-react";

const features = [
  { icon: Cpu, title: "Host Monitoring", desc: "Live CPU, memory, disk, uptime, and host health across self-hosted, cloud, and enterprise deployments." },
  { icon: Search, title: "Service Discovery", desc: "Discover known services quickly so the product becomes useful without hand-modeling everything first." },
  { icon: Bell, title: "Alerts and Incidents", desc: "Operate from real alerts, acknowledgement, resolution flow, and incident context instead of dashboard theatre." },
  { icon: Bot, title: "AI Copilot", desc: "Use AI with actual monitoring context, either via BYOK or bundled AI usage depending on the edition." },
  { icon: ShieldCheck, title: "Read-only Inspection", desc: "Inspect system state through bounded agent actions without turning the product into a remote shell." },
  { icon: Building2, title: "Team and Workspace Model", desc: "Move from single-operator setups toward shared ownership and environment scoping." },
  { icon: KeyRound, title: "Identity Path", desc: "Add SSO, SAML, SCIM, and stronger role control when you need organizational maturity." },
  { icon: ScrollText, title: "Audit Visibility", desc: "Track important operational and security-sensitive changes in environments that need more control." },
  { icon: CalendarClock, title: "Maintenance and Silences", desc: "Reduce alert noise during planned work and keep the operational surface calmer." },
  { icon: LayoutDashboard, title: "Dashboards", desc: "Use clear dashboards for infrastructure visibility without dragging in a bloated observability suite." },
  { icon: FileText, title: "Logs and Transactions", desc: "Correlate logs, alerts, incidents, and synthetic runs in one product story." },
  { icon: Cog, title: "Systemd-native Agents", desc: "Deploy agents as normal services on Linux hosts rather than hiding them in unnecessary complexity." },
];

const FeatureGrid = () => (
  <section id="features" className="py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-display font-bold text-foreground sm:text-4xl">A real core product, then the right layers on top.</h2>
        <p className="text-lg text-muted-foreground">The split is not about crippling the core. It is about separating product value, hosted convenience, and enterprise control cleanly.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="group rounded-lg border border-border bg-card/40 p-5 transition-all duration-200 hover:border-primary/30 hover:bg-card/70"
          >
            <div className="mb-3 inline-flex rounded-md border border-border bg-accent/60 p-2 text-primary transition-colors duration-200 group-hover:border-primary/30">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-1.5 font-display font-semibold text-foreground">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureGrid;
