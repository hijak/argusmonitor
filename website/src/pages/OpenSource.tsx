import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const faqs = [
  {
    q: "Is the self-hosted edition actually useful on its own?",
    a: "Yes. The goal is a real open-source core product, not a crippled teaser. Self-Hosted should include core monitoring, alerts, dashboards, logs, transactions, agents, service discovery, and API access.",
  },
  {
    q: "What is the difference between Self-Hosted and Cloud?",
    a: "Cloud is the same product story with less operational burden. You pay for managed hosting, included AI usage, easier onboarding, upgrades, and backups — not because the product was artificially starved.",
  },
  {
    q: "What is Enterprise for?",
    a: "Enterprise is for organizational control: SSO, SCIM, SAML, stronger RBAC, auditability, private deployment options, and support for formal buyers.",
  },
  {
    q: "Can I bring my own AI provider key?",
    a: "Yes. BYOK fits naturally in the self-hosted story and can remain available as an advanced option elsewhere too.",
  },
  {
    q: "What licensing approach fits this model best?",
    a: "The current recommendation is an AGPL core with proprietary enterprise layers where needed. That preserves a real open-source story while giving some protection against straight hosted resellers.",
  },
  {
    q: "Is Enterprise just basic security behind a paywall?",
    a: "It should not be. Basic secure deployment belongs in the core product. Enterprise should add organizational identity, governance, support, and private deployment controls.",
  },
];

const OpenSource = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <section className="border-b border-border pt-28 pb-14">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-display font-extrabold text-foreground sm:text-5xl">Open source, open core, and licensing</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            The goal is simple: a self-hosted open-source Vordr that is genuinely useful on its own, with Cloud and Enterprise adding convenience and organizational control rather than starving the core product.
          </p>
        </div>
      </div>
    </section>

    <section className="py-16 lg:py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle>Recommended model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Self-Hosted</strong> should be the open-source core product.</p>
              <p><strong className="text-foreground">Cloud</strong> should monetize convenience: managed hosting, upgrades, backups, and included AI usage.</p>
              <p><strong className="text-foreground">Enterprise</strong> should monetize identity, governance, procurement readiness, and private deployment support.</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/40">
            <CardHeader>
              <CardTitle>Licensing recommendation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Recommended:</strong> AGPL core + proprietary enterprise modules where needed.</p>
              <p>This keeps the open-source story real while adding some protection against someone simply hosting the core as a service without contributing back.</p>
              <p>The product story should stay about usefulness and control, not about turning licensing into the whole pitch.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>

    <section className="border-t border-border py-16 lg:py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-display font-bold text-foreground">FAQ</h2>
            <p className="mt-3 text-muted-foreground">The awkward questions, answered directly.</p>
          </div>
          <div className="grid gap-4">
            {faqs.map((item) => (
              <Card key={item.q} className="border-border bg-card/40">
                <CardHeader>
                  <CardTitle className="text-lg">{item.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
    <Footer />
  </div>
);

export default OpenSource;
