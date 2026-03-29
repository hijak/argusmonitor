import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustBar from "@/components/TrustBar";
import ProductSplitSection from "@/components/ProductSplitSection";
import FeatureGrid from "@/components/FeatureGrid";
import FeatureMatrixSection from "@/components/FeatureMatrixSection";
import HowItWorks from "@/components/HowItWorks";
import CopilotShowcase from "@/components/CopilotShowcase";
import HostedVsSelfHosted from "@/components/HostedVsSelfHosted";
import PricingSection from "@/components/PricingSection";
import ComparisonSection from "@/components/ComparisonSection";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <TrustBar />
    <ProductSplitSection />
    <FeatureMatrixSection />
    <FeatureGrid />
    <HowItWorks />
    <CopilotShowcase />
    <HostedVsSelfHosted />
    <PricingSection />
    <ComparisonSection />
    <FinalCTA />
    <Footer />
  </div>
);

export default Index;
