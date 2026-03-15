import { motion } from "framer-motion";
import { Minus, Zap } from "lucide-react";

const points = [
  { pain: "Heavyweight enterprise monitoring suites", solution: "Lean, focused platform — deploy in minutes" },
  { pain: "Pretty dashboards with shallow insights", solution: "Operationally useful alerts and AI-assisted troubleshooting" },
  { pain: "Not designed for self-hosters or small teams", solution: "Built for homelabs, startups, and indie ops" },
  { pain: "AI chatbots with zero operational context", solution: "AI copilot grounded in your actual monitoring data" },
  { pain: "Agents that require containers for everything", solution: "Native systemd agents with optional container visibility" },
  { pain: "Black-box remote access tools", solution: "Safe, bounded read-only inspections through agents" },
];

const ComparisonSection = () => (
  <section className="py-20 lg:py-28 border-t border-border">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">Why ArgusMonitor?</h2>
        <p className="text-muted-foreground text-lg">Built for operators who want clarity, not complexity.</p>
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
