export type BannerImage = { url: string; width: number; height: number; publicId?: string };
export type BannerLink = { label: string; href: string };
export type BannerTextPosition = "left" | "center" | "right";
export type BannerTextTone = "light" | "dark";

/** What the storefront needs to render a slide. */
export type StorefrontBanner = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: BannerLink | null;
  secondaryCta: BannerLink | null;
  image: BannerImage;
  mobileImage: BannerImage | null;
  imageAlt: string;
  textPosition: BannerTextPosition;
  textTone: BannerTextTone;
  overlayOpacity: number;
};

/** Admin record, including scheduling and status. */
export type AdminBanner = Omit<StorefrontBanner, "primaryCta" | "secondaryCta"> & {
  name: string;
  primaryCta: BannerLink;
  secondaryCta: BannerLink;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  sortOrder: number;
  status: "live" | "scheduled" | "ended" | "hidden";
  updatedAt: string;
};
