import { ChevronLeft, ChevronRight } from "lucide-react";
import CurrentBatchGrid from "@/components/landing/current-batch-grid";
import SectionHeading from "@/components/ui/section-heading";

export default function BatchesSection() {
  return (
    <section className="batches-section content-width" id="batches">
      <SectionHeading
        title="Trending Batches"
        className="batch-section-heading"
        action={(
          <div className="carousel-controls" aria-hidden="true">
            <span><ChevronLeft size={16} /></span>
            <span><ChevronRight size={16} /></span>
          </div>
        )}
      >
        <div className="batch-tabs" aria-label="Batch type">
          <span className="tab tab-active">Active Auctions</span>
          <span className="tab">Fixed Price</span>
        </div>
      </SectionHeading>
      <CurrentBatchGrid />
    </section>
  );
}