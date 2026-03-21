import { Activity, GitPullRequest, PackageSearch } from "lucide-react";

const REPO_URL = "https://github.com/hijak/vordr";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted/60 to-background pb-20 pt-16">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="container relative z-10 mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center gap-2.5 opacity-0 animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">Vordr</span>
        </div>

        <h1
          className="max-w-3xl text-balance text-3xl font-bold leading-[1.05] tracking-tight text-foreground opacity-0 animate-fade-up sm:text-4xl md:text-5xl"
          style={{ animationDelay: "200ms" }}
        >
          Official plugin directory for Vordr
        </h1>

        <p
          className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground opacity-0 animate-fade-up sm:text-lg"
          style={{ animationDelay: "320ms" }}
        >
          Browse the official collectors and UI integrations we have already built in the monolith.
          The long-term plan is to split pieces into their own directories and repos, but right now this page is the source of truth for what ships.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 opacity-0 animate-fade-up" style={{ animationDelay: "440ms" }}>
          <a
            href="#plugins"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.97]"
          >
            <PackageSearch className="h-4 w-4" />
            Browse official plugins
          </a>
          <a
            href={`${REPO_URL}/pulls`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-accent active:scale-[0.97]"
          >
            <GitPullRequest className="h-4 w-4" />
            Submit a plugin PR
          </a>
        </div>
      </div>
    </section>
  );
}
