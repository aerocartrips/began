import EnterpriseSignupCard from "@/components/marketplace/enterprise-signup-card";
import Statistic from "@/components/ui/statistic";

export default function NetworkSection() {
  return (
    <section className="network-section" id="network">
      <div className="network-glow" aria-hidden="true" />
      <div className="network-grid content-width">
        <div className="network-copy">
          <h2>Decentralized <span>Weaver Direct</span> API</h2>
          <p>
            Our 2070 logistics layer uses quantum-secured smart contracts
            to ensure 100% payout to weavers the moment your shipment clears
            global customs.
          </p>
          <div className="network-stats">
            <Statistic value="0.4s" label="Transaction Speed" />
            <Statistic value="99.9%" label="Logistics Uptime" />
          </div>
        </div>
        <EnterpriseSignupCard />
      </div>
    </section>
  );
}