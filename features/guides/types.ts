/** Buying guides (lib/content/guides.js, lib/services/guide.service.js). */

export type GuideImage = { url: string; publicId: string; width: number; height: number };
export type GuideSection = { heading: string; body: string };

export type GuideSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: GuideImage | null;
  coverAlt: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
};

export type GuideArticle = GuideSummary & { sections: GuideSection[] };

export type AdminGuide = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: GuideImage | null;
  coverAlt: string;
  sections: GuideSection[];
  status: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
};
