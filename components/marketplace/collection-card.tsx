import Link from "next/link";
import { ChevronRight, Cpu, Dna, Globe2, Wind } from "lucide-react";
import type { Collection } from "@/data/marketplace";
import TextLink from "@/components/ui/text-link";

type CollectionCardProps = {
  collection: Collection;
};

const collectionIcons = { cpu: Cpu, dna: Dna, wind: Wind, globe: Globe2 };

export default function CollectionCard({ collection }: CollectionCardProps) {
  const Icon = collectionIcons[collection.icon] ?? Globe2;

  return (
    <Link className={`collection-card ${collection.tone}`} href="/#batches">
      <span className="collection-icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.7} />
      </span>
      <h3>{collection.title}</h3>
      <p>{collection.description}</p>
      <TextLink icon={<ChevronRight size={12} aria-hidden="true" />}>
        Explore
      </TextLink>
    </Link>
  );
}