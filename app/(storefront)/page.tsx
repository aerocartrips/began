import BatchesSection from "@/components/landing/batches-section";
import CollectionsSection from "@/components/landing/collections-section";
import HeroSection from "@/components/landing/hero-section";
import NetworkSection from "@/components/landing/network-section";

export default function Home() {
  return (
    <>
      <HeroSection />
      <CollectionsSection />
      <BatchesSection />
      <NetworkSection />
    </>
  );
}
