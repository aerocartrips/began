import StoreContentPage, { storePageMetadata } from "@/components/content/store-content-page";

export const generateMetadata = () => storePageMetadata("faq");

export default function Page() {
  return <StoreContentPage slug="faq" />;
}
