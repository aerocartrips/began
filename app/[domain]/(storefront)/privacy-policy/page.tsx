import StoreContentPage, { storePageMetadata } from "@/components/content/store-content-page";

export const generateMetadata = () => storePageMetadata("privacy-policy");

export default function Page() {
  return <StoreContentPage slug="privacy-policy" />;
}
