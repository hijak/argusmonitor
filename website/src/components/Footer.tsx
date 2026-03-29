import { Activity } from "lucide-react";
import { DOCS_URL, GITHUB_URL, PLUGIN_DIRECTORY_URL } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Editions", href: "/#editions" },
      { label: "Pricing", href: "/pricing" },
      { label: "Open Source", href: "/open-source" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: DOCS_URL },
      { label: "Plugin Directory", href: PLUGIN_DIRECTORY_URL },
      { label: "GitHub", href: GITHUB_URL },
      { label: "Contact", href: "mailto:plutus.ghost@gmail.com" },
    ],
  },
  {
    title: "Positioning",
    links: [
      { label: "Self-Hosted", href: "/open-source" },
      { label: "Cloud", href: "/pricing" },
      { label: "Enterprise", href: "/pricing" },
    ],
  },
];

const Footer = () => (
  <footer className="border-t border-border bg-card/20 py-12">
    <div className="container mx-auto px-4 lg:px-8">
      <div className="grid gap-8 sm:grid-cols-4">
        <div>
          <a href="/" className="mb-3 flex items-center gap-2 font-display font-bold text-foreground">
            <Activity className="h-5 w-5 text-primary" /> Vordr
          </a>
          <p className="text-sm leading-relaxed text-muted-foreground">Open-source core monitoring with a managed cloud option and an enterprise path for identity, governance, and support.</p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 font-display text-sm font-semibold text-foreground">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Vordr. One product, three ways to buy it.
      </div>
    </div>
  </footer>
);

export default Footer;
