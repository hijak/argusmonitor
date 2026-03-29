import Navbar from "@/components/Navbar";
import PricingSection from "@/components/PricingSection";
import FeatureMatrixSection from "@/components/FeatureMatrixSection";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const Pricing = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <div className="border-b border-border pt-28 pb-12">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-display font-extrabold text-foreground sm:text-5xl">Pricing and packaging</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            One product, three ways to buy it: open-source Self-Hosted, managed Cloud, and Enterprise for identity, governance, and private deployment.
          </p>
        </div>
      </div>
    </div>
    <PricingSection />
    <FeatureMatrixSection />
    <FinalCTA />
    <Footer />
  </div>
);

export default Pricing;
