/**
 * TEST DATA ONLY. Adds sample customer reviews to a store's test products
 * (from `npm run seed:test`) so ratings, the review list, star filters,
 * "Show more", photo reviews and the moderation queue can be previewed.
 *
 *   npm run seed:test-reviews -- --tenant norosilk                # add
 *   npm run seed:test-reviews -- --tenant norosilk --no-photos    # add, without uploading photos
 *   npm run seed:test-reviews -- --tenant norosilk --remove       # delete everything this script added
 *
 * Everything is marked so it can be removed cleanly: the reviewers are
 * inactive customer accounts (they cannot sign in) on the reserved
 * ".invalid" email domain, and review photos carry the Cloudinary tag below.
 * Reviews point at made-up order ids (no orders are created, so revenue and
 * order numbers are untouched); the admin "Order" link of a seeded review
 * therefore leads nowhere. Product ratings are recomputed with the app's own
 * code. A running dev server may show the old rating for up to a minute (cache).
 */
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { connect, disconnect, fail, parseCli } from "./lib/cli.mjs";
import { Tenant } from "@/lib/db/models/Tenant";
import { Product } from "@/lib/db/models/Product";
import { Review } from "@/lib/db/models/Review";
import { ReviewVote } from "@/lib/db/models/ReviewVote";
import { User } from "@/lib/db/models/User";
import { runWithTenant } from "@/lib/tenant/context";
import { getCloudinary } from "@/lib/cloudinary/config";
import { CLOUDINARY_FOLDERS, storeFolder } from "@/lib/constants/cloudinary-folders";
import { mapUploadResult } from "@/lib/cloudinary/transformations";
import { REVIEW_MODERATION_STATUS, REVIEW_VERIFICATION_STATUS } from "@/lib/constants/review-status";
import { hashPassword } from "@/lib/auth/password";
import { recomputeProductRatingSummary } from "@/lib/services/review-rating.service";

const TAG = "norosilk-test-reviews";
const EMAIL_DOMAIN = "reviews.test-seed.invalid";
const EMAIL_PATTERN = /@reviews\.test-seed\.invalid$/;
const PHOTO_COUNT = 6;
/** The most popular test product gets enough reviews for "Show more" (8 per page). */
const SHOWCASE_RATINGS = [5, 5, 4, 5, 3, 5, 5, 4, 2, 5, 5, 4, 5, 5];
/** Further products get a handful each; the rest keep the "No reviews yet" state. */
const REVIEWED_PRODUCTS = 24;

const args = parseCli(
  {
    tenant: { type: "string" },
    remove: { type: "boolean", default: false },
    "no-photos": { type: "boolean", default: false },
  },
  "Usage: npm run seed:test-reviews -- --tenant <slug> [--no-photos] [--remove]",
);
if (!args.tenant) fail("--tenant is required.");

const REVIEWERS = [
  "Priya Sharma", "Ananya Iyer", "Meera Nair", "Kavya Reddy", "Lakshmi Raman", "Sneha Patil",
  "Divya Menon", "Pooja Agarwal", "Ritu Malhotra", "Shalini Gupta", "Nandini Rao", "Aishwarya Pillai",
  "Farah Khan", "Harpreet Kaur", "Sunita Joshi", "Revathi Krishnan", "Neha Bansal", "Tanvi Desai",
];

/** [title, comment] by star rating; written from a retailer's point of view, true of any saree. */
const COMMENTS = {
  5: [
    ["Sold out in a week", "Ordered 25 pieces for our Chennai store and every one of them sold within a week. The zari is bright, the fabric has a lovely fall and the colours match the photos exactly."],
    ["Exactly as shown", "Colour, border and pallu are exactly as in the photos. Our customers loved the drape. We will reorder for the wedding season."],
    ["Premium finish at a fair price", "The finishing is neat with no loose threads, and the blouse piece is generous. At this wholesale rate the margins work very well for us."],
    ["Great packing and quick dispatch", "Every saree came individually folded with the tag intact. Dispatched in two days and reached Hyderabad on time."],
    ["Our customers keep asking for more", "We run a boutique in Pune and took a mixed lot of colours for the festive season. The weave is consistent across the lot, which matters when customers compare pieces side by side. The pallu work is rich without being heavy, so it suits both younger and older buyers. Two customers came back to buy a second colour. Packing was neat and the invoice matched the order exactly. We are already planning the next order and will add the darker shades this time."],
    ["Beautiful sheen", "The fabric has a soft natural sheen that looks even better in person than in the photos. Very happy with this lot."],
    ["Reliable supplier", "This is our third order and the quality has been consistent every time. Replies on WhatsApp were quick and helpful."],
    ["", "Lovely colours and a soft, comfortable drape. Customers say it is light enough to wear all day."],
    ["Worth every rupee", "The border work is detailed and the colour did not bleed after the first dry clean. Great value at this price."],
  ],
  4: [
    ["Very good, slightly darker shade", "Good fabric and finishing. The colour is a shade darker than the photo, but our customers still liked it."],
    ["Good quality, delivery a little slow", "The sarees are well made and the zari is good. Delivery to Kolkata took six days, a bit longer than expected."],
    ["Nice drape", "Soft fabric with a nice fall. The blouse piece could be a little longer, otherwise very good."],
    ["", "Good product for the price. Packing could be sturdier for bulk orders, but nothing was damaged."],
    ["Happy with the lot", "Consistent quality across 30 pieces. One piece had a small pull in the pallu, which they replaced quickly."],
  ],
  3: [
    ["Average zari work", "The fabric is fine, but the zari is lighter than I expected from the photos. Okay for our daily-wear range."],
    ["Okay for the price", "A decent saree for the price. The colours are slightly different from the website. Customer service was helpful."],
  ],
  2: [["Colour did not match", "The colour looked quite different from the photos and two pieces had uneven borders. Support offered a return, which was handled properly."]],
  1: [["Not as expected", "The fabric felt thinner than described and the pallu work was uneven. We returned the lot and the refund came through after inspection."]],
};

/** Deterministic PRNG so reruns produce the same reviews. */
function prng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Uploads remote images in parallel (bounded), returning stored image records. */
async function uploadPool(cloudinary, sources, folder) {
  const results = new Array(sources.length);
  let next = 0;
  async function worker() {
    while (next < sources.length) {
      const index = next++;
      const { url, publicId } = sources[index];
      const result = await cloudinary.uploader.upload(url, { folder, public_id: publicId, overwrite: true, tags: [TAG], resource_type: "image" });
      results[index] = mapUploadResult(result);
      process.stdout.write(`\rReview photos uploaded: ${results.filter(Boolean).length}/${sources.length}`);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  process.stdout.write("\n");
  return results;
}

await connect();
const tenant = await Tenant.findOne({ slug: args.tenant }).lean();
if (!tenant) fail(`No store with slug "${args.tenant}".`);

await runWithTenant(String(tenant._id), async () => {
  if (args.remove) {
    const reviewers = await User.find({ email: EMAIL_PATTERN }).select("_id").lean();
    const reviewerIds = reviewers.map((user) => user._id);
    const reviews = await Review.find({ user: { $in: reviewerIds } }).select("_id product").lean();
    const productIds = [...new Set(reviews.map((review) => String(review.product)))];
    await ReviewVote.deleteMany({ review: { $in: reviews.map((review) => review._id) } });
    const removed = await Review.deleteMany({ user: { $in: reviewerIds } });
    const users = await User.deleteMany({ _id: { $in: reviewerIds } });
    for (const productId of productIds) await recomputeProductRatingSummary(productId);
    let photos = 0;
    try {
      photos = Object.keys((await getCloudinary().api.delete_resources_by_tag(TAG)).deleted ?? {}).length;
    } catch (error) {
      process.stdout.write(`Photos not removed from Cloudinary: ${error.message}\n`);
    }
    process.stdout.write(
      `Removed ${removed.deletedCount} test reviews, ${users.deletedCount} test reviewers and ${photos} photos; recomputed ${productIds.length} product ratings.\n`,
    );
    return;
  }

  if (await User.exists({ email: EMAIL_PATTERN })) {
    fail("Test reviews already exist in this store. Run with --remove first to recreate them.");
  }
  const products = await Product.find({ status: "active", sku: /^TST-/ })
    .sort({ popularityScore: -1, _id: -1 })
    .limit(REVIEWED_PRODUCTS)
    .select("_id name")
    .lean();
  if (products.length === 0) fail("No test products in this store. Run `npm run seed:test -- --tenant <slug>` first.");

  const random = prng(2611);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const weightedRating = () => {
    const roll = random();
    return roll < 0.55 ? 5 : roll < 0.83 ? 4 : roll < 0.93 ? 3 : roll < 0.98 ? 2 : 1;
  };

  const password = await hashPassword(randomBytes(32).toString("hex"));
  const reviewers = await User.insertMany(
    REVIEWERS.map((name, index) => {
      const [firstName, ...rest] = name.split(" ");
      return {
        name,
        firstName,
        lastName: rest.join(" "),
        email: `reviewer-${String(index + 1).padStart(2, "0")}@${EMAIL_DOMAIN}`,
        password,
        role: "customer",
        isActive: false,
      };
    }),
  );

  let photos = [];
  if (!args["no-photos"]) {
    try {
      photos = await uploadPool(
        getCloudinary(),
        Array.from({ length: PHOTO_COUNT }, (_, index) => ({
          url: `https://picsum.photos/seed/norosilk-review-${index + 1}/900/1125`,
          publicId: `test-review-${index + 1}`,
        })),
        storeFolder(CLOUDINARY_FOLDERS.reviews),
      );
    } catch (error) {
      process.stdout.write(`\nSkipping review photos (upload failed: ${error.message}).\n`);
      photos = [];
    }
  }
  const photo = (index) => ({ ...photos[index % photos.length], url: photos[index % photos.length].secureUrl, alt: "Customer review photo" });

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const docs = [];
  let photoIndex = 0;
  products.forEach((product, productIndex) => {
    const ratings =
      productIndex === 0 ? SHOWCASE_RATINGS : Array.from({ length: 2 + Math.floor(random() * 6) }, weightedRating);
    // A different reviewer for each review of a product (one review per buyer and product),
    // and no comment twice on the same product.
    const offset = Math.floor(random() * REVIEWERS.length);
    const used = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((rating, index) => {
      const pool = COMMENTS[rating];
      const [title, comment] = pool[(productIndex + used[rating]++) % pool.length];
      const createdAt = new Date(now - Math.floor((index * 9 + random() * 8 + productIndex) * DAY) - Math.floor(random() * DAY));
      const withPhotos = photos.length > 0 && rating >= 4 && (productIndex === 0 ? index % 4 === 1 : random() < 0.12);
      const images = withPhotos ? Array.from({ length: 1 + (photoIndex % 3) }, () => photo(photoIndex++)) : [];
      docs.push({
        user: reviewers[(offset + index) % reviewers.length]._id,
        product: product._id,
        order: new mongoose.Types.ObjectId(),
        rating,
        title,
        comment,
        images,
        verificationStatus: REVIEW_VERIFICATION_STATUS.VERIFIED,
        moderationStatus: REVIEW_MODERATION_STATUS.APPROVED,
        moderatedAt: createdAt,
        helpfulCount: rating >= 4 ? Math.floor(random() * 15) : Math.floor(random() * 4),
        createdAt,
        updatedAt: createdAt,
      });
    });
  });

  // A small moderation queue for Admin → Reviews: two awaiting approval, one rejected.
  const queue = [
    [REVIEW_MODERATION_STATUS.PENDING, 5, ""],
    [REVIEW_MODERATION_STATUS.PENDING, 3, ""],
    [REVIEW_MODERATION_STATUS.REJECTED, 1, "Mentions another seller's prices."],
  ];
  queue.forEach(([moderationStatus, rating, moderationNote], index) => {
    const product = products[index + 1] ?? products[0];
    const taken = new Set(docs.filter((doc) => String(doc.product) === String(product._id)).map((doc) => String(doc.user)));
    const reviewer = reviewers.find((user) => !taken.has(String(user._id)));
    if (!reviewer) return;
    const [title, comment] = pick(COMMENTS[rating]);
    const createdAt = new Date(now - (index + 1) * 3 * 60 * 60 * 1000);
    docs.push({
      user: reviewer._id,
      product: product._id,
      order: new mongoose.Types.ObjectId(),
      rating,
      title,
      comment,
      images: [],
      verificationStatus: REVIEW_VERIFICATION_STATUS.VERIFIED,
      moderationStatus,
      moderationNote,
      moderatedAt: moderationStatus === REVIEW_MODERATION_STATUS.REJECTED ? createdAt : null,
      helpfulCount: 0,
      createdAt,
      updatedAt: createdAt,
    });
  });

  // Keep the dates above: these are backdated sample reviews.
  await Review.insertMany(docs, { timestamps: false });
  for (const product of products) await recomputeProductRatingSummary(product._id);

  const approved = docs.filter((doc) => doc.moderationStatus === REVIEW_MODERATION_STATUS.APPROVED).length;
  process.stdout.write(
    `Added ${approved} approved reviews (${docs.filter((doc) => doc.images.length).length} with photos) on ${products.length} test products, ` +
      `${docs.length - approved} for moderation, from ${reviewers.length} test reviewers in ${tenant.slug}.\n` +
      `Most reviewed: "${products[0].name}" (${SHOWCASE_RATINGS.length} reviews).\n`,
  );
});

await disconnect();
