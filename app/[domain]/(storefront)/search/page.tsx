import { permanentRedirect } from "next/navigation";

type SearchPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** /search?q=… is served by the catalogue listing; one search page to maintain. */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value ? [value] : []) params.append(key, entry);
  }
  const search = params.toString();
  permanentRedirect(search ? `/products?${search}` : "/products");
}
