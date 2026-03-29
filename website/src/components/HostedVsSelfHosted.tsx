import { Check, Server, Cloud, Building2 } from "lucide-react";

const Column = ({ icon: Icon, title, subtitle, items }: { icon: React.ElementType; title: string; subtitle: string; items: string[] }) => (
  <div className="space-y-4 rounded-lg border border-border bg-card/40 p-6">
    <div className="inline-flex rounded-md border border-border bg-accent/60 p-2 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="font-display text-xl font-bold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground">{subtitle}</p>
    <ul className="space-y-2 pt-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const HostedVsSelfHosted = () => (
  <section className="border-t border-border py-20 lg:py-28">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <h2 className="mb-4 text-3xl font-display font-bold text-foreground sm:text-4xl">Choose the deployment and control model that fits.</h2>
        <p className="text-lg text-muted-foreground">
          The product split is deployment- and control-driven, not random feature starvation.
        </p>
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
        <Column
          icon={Server}
          title="Self-Hosted"
          subtitle="Run the control plane yourself and keep the full core product in your own environment."
          items={[
            "Open-source core product",
            "Run your own control plane",
            "Core monitoring, alerts, logs, and dashboards",
            "Best for technical operators and internal evaluation",
          ]}
        />
        <Column
          icon={Cloud}
          title="Cloud"
          subtitle="Use the same product without managing the control plane yourself."
          items={[
            "Managed control plane",
            "Included AI usage",
            "Managed upgrades and backups",
            "Best for faster onboarding and less ops overhead",
          ]}
        />
        <Column
          icon={Building2}
          title="Enterprise"
          subtitle="Add the identity, governance, support, and deployment controls formal teams need."
          items={[
            "SSO / SCIM / SAML",
            "Audit and advanced RBAC",
            "Private deployment options",
            "Best for larger teams and buyer review",
          ]}
        />
      </div>
    </div>
  </section>
);

export default HostedVsSelfHosted;
