import { motion } from "framer-motion";
import { Minus, Zap } from "lucide-react";

const points = [
  { pain: "Heavyweight enterprise monitoring suites", solution: "Lean platform with enterprise foundations, not enterprise bloat" },
  { pain: "Pretty dashboards with shallow insights", solution: "Operational alerts, incidents, on-call ownership, and AI-assisted troubleshooting" },
  { pain: "Single-tenant tools pretending to be enterprise", solution: "Organizations, workspaces, RBAC, OIDC, and audit trail foundations now landing" },
  { pain: "Alerting that becomes pure noise during change windows", solution: "Maintenance windows and alert silences to calm the blast radius" },
  { pain: "Notification integrations that only look connected", solution: "Real webhook, Slack, and SMTP delivery paths" },
  { pain: "AI chatbots with zero operational context", solution: "AI copilot grounded in your actual monitoring data" },
];

const ComparisonSection = () => (
  <section className="py-20 lg:py-28 border-t border-border">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">Why ArgusMonitor?</h2>
        <p className="text-muted-foreground text-lg">Built for operators who want clarity, not complexity — and now growing the right enterprise muscles.</p>
      </div>
      <div className="mx-auto max-w-3xl space-y-3">
        {points.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="grid sm:grid-cols-2 gap-3 sm:gap-6 rounded-lg border border-border bg-card/30 p-4"
          >
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Minus className="h-4 w-4 flex-shrink-0 text-destructive mt-0.5" />
              {p.pain}
            </div>
            <div className="flex items-start gap-2 text-sm text-foreground">
              <Zap className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
              {p.solution}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ComparisonSection;
