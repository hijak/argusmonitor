import { Check, Server, Cloud } from "lucide-react";

const Column = ({ icon: Icon, title, subtitle, items }: { icon: React.ElementType; title: string; subtitle: string; items: string[] }) => (
  <div className="rounded-lg border border-border bg-card/40 p-6 space-y-4">
    <div className="inline-flex rounded-md border border-border bg-accent/60 p-2 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <h3 className="font-display font-bold text-xl text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground">{subtitle}</p>
    <ul className="space-y-2 pt-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 flex-shrink-0 text-success mt-0.5" />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const HostedVsSelfHosted = () => (
  <section className="py-20 lg:py-28 border-t border-border">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-2xl text-center mb-14">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4">Self-hosted or managed. Your call.</h2>
        <p className="text-muted-foreground text-lg">Start self-hosted and upgrade to the managed platform when you're ready.</p>
      </div>
      <div className="mx-auto max-w-3xl grid md:grid-cols-2 gap-6">
        <Column
          icon={Server}
          title="Self-Hosted / Community"
          subtitle="Full control, run your own backend."
          items={["Run your own control plane", "Basic monitoring features", "Dashboards, alerts, service discovery", "Limited nodes", "Ideal for homelabs and tinkering"]}
        />
        <Column
          icon={Cloud}
          title="Hosted"
          subtitle="Managed control plane — just install agents."
          items={["No backend to manage", "AI copilot with included credits", "Read-only host inspections", "Scale by node count", "Optional BYOK for advanced users", "Easier onboarding and setup"]}
        />
      </div>
    </div>
  </section>
);

export default HostedVsSelfHosted;
