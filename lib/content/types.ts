export type StorePageSection = { heading: string; body: string };
export type StorePageFaq = { question: string; answer: string };

export type StorePageContent = {
  slug: string;
  title: string;
  summary: string;
  sections: StorePageSection[];
  faqs: StorePageFaq[];
  /** True while the store still shows the default template. */
  isDefault: boolean;
  updatedAt: string | null;
};
