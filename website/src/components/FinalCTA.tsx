import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { DEMO_URL, GITHUB_URL, PLUGIN_DIRECTORY_URL, START_URL } from "@/lib/site";

const FinalCTA = () => (
  <section className="relative overflow-hidden border-t border-border py-20 lg:py-28">
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent" />
    <div className="container relative mx-auto px-4 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        <h2 className="text-3xl font-display font-bold text-foreground sm:text-4xl">Start open source. Move to cloud. Grow into enterprise.</h2>
        <p className="text-lg text-muted-foreground">
          The product should scale with your operational needs, not force you into a different personality every time you outgrow a tier.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild variant="hero" size="lg"><a href={START_URL} target="_blank" rel="noreferrer">Start Self-Hosted</a></Button>
          <Button asChild variant="hero-outline" size="lg"><a href={DEMO_URL}>Talk About Cloud / Enterprise</a></Button>
          <Button asChild variant="secondary" size="lg"><a href={PLUGIN_DIRECTORY_URL} target="_blank" rel="noreferrer">Browse Plugins</a></Button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
            <Github className="h-4 w-4" /> View on GitHub
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default FinalCTA;
