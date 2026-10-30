import Image from "next/image";
import { ArrowRight } from "lucide-react";
import AuctionNote from "@/components/marketplace/auction-note";
import { auctionAvatars } from "@/data/marketplace";
import Button from "@/components/ui/button";
import Statistic from "@/components/ui/statistic";

export default function HeroSection() {
  return (
    <header className="hero">
      <div className="hero-grid content-width">
        <div className="hero-copy">
          <div className="eyebrow"><span />Fiscal Year 2070</div>
          <h1>Ethereal <span className="gradient-text">Quantum</span> Weaves</h1>
          <p className="hero-description">
            The first decentralized B2B network connecting heritage weavers
            with global retail giants. Experience textile sourcing powered
            by 2070 quantum logic.
          </p>
          <div className="hero-actions">
            <Button
              href="/#batches"
              icon={<ArrowRight size={15} aria-hidden="true" />}
            >
              Enter Marketplace
            </Button>
            <Button href="/#enterprise" variant="secondary">
              Request Batch Quote
            </Button>
          </div>
          <div className="hero-stats" aria-label="Marketplace statistics">
            <Statistic value="12k+" label="Verified Hubs" />
            <i aria-hidden="true" />
            <Statistic value="48" label="Active Nations" />
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-image-frame">
            <Image
              src="https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_4326f50a49_8d8ab5eb1f26da94.png"
              alt="Model wearing a pastel floral silk saree with traditional jewelry"
              fill
              priority
              sizes="(max-width: 760px) 92vw, (max-width: 1100px) 70vw, 45vw"
              className="cover-image hero-image"
            />
          </div>
          <AuctionNote
            message="“Aurora Silk Batch #441 is now open for bidding.”"
            avatars={auctionAvatars}
            additionalCount={12}
          />
        </div>
      </div>
    </header>
  );
}