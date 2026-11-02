import StoreContentPage, { storePageMetadata } from "@/components/content/store-content-page";

export const generateMetadata = () => storePageMetadata("returns");

export default function Page() {
  return <StoreContentPage slug="returns" />;
}
