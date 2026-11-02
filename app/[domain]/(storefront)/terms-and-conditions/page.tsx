import StoreContentPage, { storePageMetadata } from "@/components/content/store-content-page";

export const generateMetadata = () => storePageMetadata("terms-and-conditions");

export default function Page() {
  return <StoreContentPage slug="terms-and-conditions" />;
}
