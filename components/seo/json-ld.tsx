import { serializeJsonLd } from "@/lib/seo/json-ld";

/** Structured data script. Always use this instead of a hand-written dangerouslySetInnerHTML. */
export default function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
