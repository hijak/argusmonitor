import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { DEMO_URL, GITHUB_URL, START_URL } from "@/lib/site";

const FinalCTA = () => (
  <section className="py-20 lg:py-28 border-t border-border relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
    <div className="container mx-auto px-4 lg:px-8 relative">
      <div className="mx-auto max-w-2xl text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">Ready to monitor without the bloat?</h2>
        <p className="text-lg text-muted-foreground">Deploy in minutes. Self-hosted or managed — your infrastructure, your way.</p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild variant="hero" size="lg"><a href={START_URL} target="_blank" rel="noreferrer">Start Free</a></Button>
          <Button asChild variant="hero-outline" size="lg"><a href={DEMO_URL}>Book Demo</a></Button>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
            <Github className="h-4 w-4" /> View on GitHub
          </a>
        </div>
      </div>
    </div>
  </section>
);

export default FinalCTA;
