export const REVIEW_MODERATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const REVIEW_VERIFICATION_STATUS = {
  VERIFIED: "verified_purchase",
  UNVERIFIED: "unverified",
};

export const REVIEW_MODERATION_VALUES = Object.values(REVIEW_MODERATION_STATUS);

export const MAX_REVIEW_IMAGES = 5;
export const MIN_REVIEW_COMMENT_LENGTH = 20;
export const MAX_REVIEW_COMMENT_LENGTH = 2000;
export const MAX_REVIEW_TITLE_LENGTH = 120;

/** Reviews per page on the product page (the first page renders with the product). */
export const PUBLIC_REVIEW_PAGE_SIZE = 8;

export const PUBLIC_REVIEW_SORT = {
  RECENT: "recent",
  HIGHEST: "highest",
  LOWEST: "lowest",
  PHOTOS: "photos",
};
