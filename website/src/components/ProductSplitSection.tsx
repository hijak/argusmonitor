import { Check, Cloud, Building2, Server } from "lucide-react";
import { motion } from "framer-motion";

const plans = [
  {
    icon: Server,
    title: "Vordr Self-Hosted",
    subtitle: "Open-source core product, run by you.",
    body: "Use the full monitoring core on your own infrastructure: hosts, services, alerts, dashboards, logs, transactions, agents, and BYOK AI.",
    bullets: [
      "Open-source self-hosted core",
      "Core monitoring, alerts, logs, and dashboards",
      "Transactions, agents, and service discovery",
      "BYOK AI and self-managed operations",
    ],
  },
  {
    icon: Cloud,
    title: "Vordr Cloud",
    subtitle: "Same product, less operational burden.",
    body: "Vordr runs the control plane, handles upgrades and backups, and includes a smoother onboarding path with bundled AI usage.",
    bullets: [
      "Managed control plane",
      "Included AI credits",
      "Easier onboarding and upgrades",
      "Shared team usage without self-running more infra",
    ],
  },
  {
    icon: Building2,
    title: "Vordr Enterprise",
    subtitle: "Organizational control, governance, and support.",
    body: "Enterprise is for teams that need identity, provisioning, audit, policy, support, and private deployment options beyond the core product story.",
    bullets: [
      "SSO / SAML / SCIM",
      "Advanced RBAC and audit visibility",
      "Private deployment options",
      "Premium support and procurement readiness",
    ],
  },
];

const ProductSplitSection = () => (
  <section id="editions" className="border-t border-border py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-display font-bold text-foreground sm:text-4xl">One product. Three ways to buy it.</h2>
        <p className="text-lg text-muted-foreground">
          Self-Hosted gives you the product. Cloud removes the operational burden. Enterprise adds organizational control.
        </p>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="rounded-xl border border-border bg-card/40 p-6"
          >
            <div className="mb-4 inline-flex rounded-md border border-border bg-accent/60 p-2 text-primary">
              <plan.icon className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-display font-bold text-foreground">{plan.title}</h3>
            <p className="mt-1 text-sm font-medium text-primary">{plan.subtitle}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{plan.body}</p>
            <ul className="mt-6 space-y-2">
              {plan.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                  {bullet}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default ProductSplitSection;
