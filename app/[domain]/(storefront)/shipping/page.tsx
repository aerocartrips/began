import StoreContentPage, { storePageMetadata } from "@/components/content/store-content-page";

export const generateMetadata = () => storePageMetadata("shipping");

export default function Page() {
  return <StoreContentPage slug="shipping" />;
}
