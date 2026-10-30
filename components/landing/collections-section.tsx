import { ArrowRight } from "lucide-react";
import CollectionCard from "@/components/marketplace/collection-card";
import { collections } from "@/data/marketplace";
import SectionHeading from "@/components/ui/section-heading";
import TextLink from "@/components/ui/text-link";

export default function CollectionsSection() {
  return (
    <section className="collections-section" id="collections">
      <div className="content-width">
        <SectionHeading
          title="Heritage Collections"
          subtitle="Direct Weaver Integration"
          action={(
            <TextLink href="/#batches" icon={<ArrowRight size={13} aria-hidden="true" />}>
              View Full Index
            </TextLink>
          )}
        />
        <div className="collection-grid">
          {collections.map((collection) => (
            <CollectionCard collection={collection} key={collection.title} />
          ))}
        </div>
      </div>
    </section>
  );
}