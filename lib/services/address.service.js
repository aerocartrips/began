import mongoose from "mongoose";
import { User } from "@/lib/db/models/User";
import { ApiError } from "@/lib/utils/api-error";
import { MAX_SAVED_ADDRESSES } from "@/lib/constants/account";
import {
  addressWriteSchema,
  defaultAddressSchema,
  parseOrThrow,
  savedAddressSchema,
} from "@/lib/validators/account.validator";

const ADDRESS_BOOK_FIELDS = "addresses defaultShippingAddressId defaultBillingAddressId";

/** Fields persisted on a saved address (excludes request-only flags). */
const ADDRESS_KEYS = [
  "label",
  "fullName",
  "phone",
  "addressLine1",
  "addressLine2",
  "landmark",
  "city",
  "state",
  "pincode",
  "country",
  "gstin",
];

function toAddressObjectId(addressId) {
  if (!mongoose.isValidObjectId(addressId)) {
    throw new ApiError(404, "Address not found.");
  }
  return new mongoose.Types.ObjectId(String(addressId));
}

function pickAddress(source) {
  return Object.fromEntries(ADDRESS_KEYS.map((key) => [key, source[key] ?? ""]));
}

/**
 * Default pointers are maintained atomically on every write. Documents created
 * before they existed fall back to a legacy `isDefault` flag or the first address.
 * @param {{ addresses?: any[]; defaultShippingAddressId?: unknown; defaultBillingAddressId?: unknown }} user
 */
export function resolveDefaultAddressIds(user) {
  const addresses = user.addresses ?? [];
  if (addresses.length === 0) return { shipping: null, billing: null };
  const ids = new Set(addresses.map((address) => String(address._id)));
  const fallback = String((addresses.find((address) => address.isDefault === true) ?? addresses[0])._id);
  const pick = (value) => (value && ids.has(String(value)) ? String(value) : fallback);
  return { shipping: pick(user.defaultShippingAddressId), billing: pick(user.defaultBillingAddressId) };
}

/**
 * Client-safe address book. Defaults are listed first, then newest first.
 * @param {{ addresses?: any[]; defaultShippingAddressId?: unknown; defaultBillingAddressId?: unknown }} user
 */
export function toAddressBook(user) {
  const defaults = resolveDefaultAddressIds(user);
  const items = (user.addresses ?? []).map((address) => {
    const id = String(address._id);
    return {
      id,
      ...pickAddress(address),
      isDefaultShipping: id === defaults.shipping,
      isDefaultBilling: id === defaults.billing,
      updatedAt: address.updatedAt ? new Date(address.updatedAt).toISOString() : null,
    };
  });
  const rank = (item) => (item.isDefaultShipping ? 0 : item.isDefaultBilling ? 1 : 2);
  items.sort((a, b) => rank(a) - rank(b) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return {
    items,
    defaultShippingId: defaults.shipping,
    defaultBillingId: defaults.billing,
    limit: MAX_SAVED_ADDRESSES,
  };
}

export async function createAddress(user, payload) {
  const { makeDefaultShipping, makeDefaultBilling, ...input } = parseOrThrow(addressWriteSchema, payload);
  const id = new mongoose.Types.ObjectId();
  const now = new Date();
  const address = { _id: id, ...pickAddress(input), createdAt: now, updatedAt: now };

  // One atomic update enforces the address cap and assigns defaults: the first
  // saved address becomes both defaults, and explicit flags take precedence.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, [`addresses.${MAX_SAVED_ADDRESSES - 1}`]: { $exists: false } },
    [
      {
        $set: {
          addresses: { $concatArrays: [{ $ifNull: ["$addresses", []] }, [{ $literal: address }]] },
          defaultShippingAddressId: makeDefaultShipping ? id : { $ifNull: ["$defaultShippingAddressId", id] },
          defaultBillingAddressId: makeDefaultBilling ? id : { $ifNull: ["$defaultBillingAddressId", id] },
          updatedAt: "$$NOW",
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true, timestamps: false },
  )
    .select(ADDRESS_BOOK_FIELDS)
    .lean();

  if (!updated) {
    throw new ApiError(409, `You can save up to ${MAX_SAVED_ADDRESSES} addresses. Remove one to add another.`);
  }
  const book = toAddressBook(updated);
  return { address: book.items.find((item) => item.id === String(id)), book };
}

export async function updateAddress(user, addressId, payload) {
  const id = toAddressObjectId(addressId);
  const { makeDefaultShipping, makeDefaultBilling, ...input } = parseOrThrow(addressWriteSchema, payload);

  /** @type {Record<string, unknown>} */
  const $set = { "addresses.$.updatedAt": new Date() };
  for (const [key, value] of Object.entries(pickAddress(input))) {
    $set[`addresses.$.${key}`] = value;
  }
  if (makeDefaultShipping) $set.defaultShippingAddressId = id;
  if (makeDefaultBilling) $set.defaultBillingAddressId = id;

  const updated = await User.findOneAndUpdate(
    { _id: user._id, "addresses._id": id },
    { $set },
    { returnDocument: "after", runValidators: true },
  )
    .select(ADDRESS_BOOK_FIELDS)
    .lean();

  if (!updated) throw new ApiError(404, "Address not found.");
  const book = toAddressBook(updated);
  return { address: book.items.find((item) => item.id === String(id)), book };
}

export async function deleteAddress(user, addressId) {
  const id = toAddressObjectId(addressId);
  const remaining = { $filter: { input: "$addresses", as: "address", cond: { $ne: ["$$address._id", id] } } };
  const reassign = (field) => ({
    $cond: [
      { $eq: [`$${field}`, id] },
      { $ifNull: [{ $arrayElemAt: ["$addresses._id", 0] }, null] },
      `$${field}`,
    ],
  });

  // Removal and default reassignment happen in a single document update, so a
  // concurrent write can never observe a default pointing at a deleted address.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, "addresses._id": id },
    [
      { $set: { addresses: remaining } },
      {
        $set: {
          defaultShippingAddressId: reassign("defaultShippingAddressId"),
          defaultBillingAddressId: reassign("defaultBillingAddressId"),
          updatedAt: "$$NOW",
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true, timestamps: false },
  )
    .select(ADDRESS_BOOK_FIELDS)
    .lean();

  if (!updated) throw new ApiError(404, "Address not found.");
  return toAddressBook(updated);
}

export async function setDefaultAddress(user, addressId, payload) {
  const id = toAddressObjectId(addressId);
  const { type } = parseOrThrow(defaultAddressSchema, payload);
  /** @type {Record<string, mongoose.Types.ObjectId>} */
  const $set = {};
  if (type === "shipping" || type === "both") $set.defaultShippingAddressId = id;
  if (type === "billing" || type === "both") $set.defaultBillingAddressId = id;

  const updated = await User.findOneAndUpdate({ _id: user._id, "addresses._id": id }, { $set }, { returnDocument: "after" })
    .select(ADDRESS_BOOK_FIELDS)
    .lean();

  if (!updated) throw new ApiError(404, "Address not found.");
  return toAddressBook(updated);
}

/**
 * Looks up a saved address inside the authenticated customer's own document
 * (so a foreign id can never match) and revalidates it with current rules.
 * @param {{ addresses?: any[] }} customer
 * @param {string} addressId
 * @param {string} field
 */
export function resolveSavedAddress(customer, addressId, field) {
  const address = mongoose.isValidObjectId(addressId)
    ? customer.addresses?.find((candidate) => String(candidate._id) === String(addressId))
    : null;
  if (!address) {
    throw new ApiError(422, "Validation failed.", [
      { field, message: "The selected address is no longer in your address book." },
    ]);
  }

  const parsed = savedAddressSchema.safeParse(pickAddress(address));
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", [
      { field, message: "The selected address is incomplete. Update it in My Addresses before checking out." },
    ]);
  }
  return parsed.data;
}
