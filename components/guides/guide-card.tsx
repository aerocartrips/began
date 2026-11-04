import Image from "next/image";
import Link from "next/link";
import { buildClientDeliveryUrl } from "@/lib/cloudinary/transformations";
import type { GuideSummary } from "@/features/guides/types";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/** Guide teaser used on the home page and the /guides index. */
export default function GuideCard({ guide, headingLevel = "h3" }: { guide: GuideSummary; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const src = guide.coverImage ? (guide.coverImage.publicId && buildClientDeliveryUrl(guide.coverImage.publicId, "productCard")) || guide.coverImage.url : "";
  return (
    <article className="guide-card">
      <Link href={`/guides/${guide.slug}`} className="guide-card__link">
        <span className="guide-card__media">
          {src ? <Image src={src} alt={guide.coverAlt} fill sizes="(max-width: 640px) 84vw, (max-width: 1100px) 46vw, 30vw" className="cover-image" /> : null}
        </span>
        <span className="guide-card__body">
          <Heading className="guide-card__title">{guide.title}</Heading>
          {guide.excerpt ? <span className="guide-card__excerpt">{guide.excerpt}</span> : null}
          <span className="guide-card__meta">
            <time dateTime={guide.publishedAt}>{dateFormat.format(new Date(guide.publishedAt))}</time> · {guide.readingMinutes} min read
          </span>
        </span>
      </Link>
    </article>
  );
}
