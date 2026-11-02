import StoreContentPage, { storePageMetadata } from "@/components/content/store-content-page";

export const generateMetadata = () => storePageMetadata("about");

export default function Page() {
  return <StoreContentPage slug="about" />;
}
