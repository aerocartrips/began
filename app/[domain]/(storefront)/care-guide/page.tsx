import StoreContentPage, { storePageMetadata } from "@/components/content/store-content-page";

export const generateMetadata = () => storePageMetadata("care-guide");

export default function Page() {
  return <StoreContentPage slug="care-guide" />;
}
