import mongoose from "mongoose";
import { z } from "zod";
import { ApiError } from "@/lib/utils/api-error";
import { userRepository } from "@/lib/repositories/user.repository";
import { buildPaginationMeta, parsePagination } from "@/lib/utils/pagination";
import { formatZodErrors } from "@/lib/validators/auth.validator";
import { DELETION_REQUEST_STATUS } from "@/lib/constants/account";
import { toDeletionRequest } from "@/lib/services/account-dto";
import { getDeletionBlockers } from "@/lib/services/account-security.service";

const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(25).optional(),
  companyName: z.string().trim().max(160).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  isActive: z.boolean().optional(),
});

export async function listCustomers(searchParams) {
  const { page, limit, skip } = parsePagination(searchParams);
  const result = await userRepository.listCustomers({ skip, limit, searchParams });
  return { items: result.items, meta: buildPaginationMeta(result.total, page, limit) };
}

export async function getCustomerSummary() {
  return userRepository.aggregateCustomerSummary();
}

export async function getCustomerById(customerId) {
  if (!mongoose.isValidObjectId(customerId)) {
    throw new ApiError(404, "Customer not found.");
  }
  const customer = await userRepository.findById(customerId);
  if (!customer || customer.role !== "customer") {
    throw new ApiError(404, "Customer not found.");
  }
  return customer;
}

export async function getCustomerDetail(customerId) {
  const customer = await getCustomerById(customerId);
  const deletionRequest = toDeletionRequest(customer);
  const [overview, blockers] = await Promise.all([
    userRepository.getCustomerOverview(customer._id),
    deletionRequest.status === DELETION_REQUEST_STATUS.PENDING ? getDeletionBlockers(customer._id) : [],
  ]);
  return { customer, overview, deletion: { ...deletionRequest, blockers } };
}

export async function updateCustomer(customerId, payload) {
  const parsed = updateCustomerSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(422, "Validation failed.", formatZodErrors(parsed.error));
  }
  const customer = await getCustomerById(customerId);
  if (parsed.data.name !== undefined) customer.name = parsed.data.name;
  if (parsed.data.phone !== undefined) customer.phone = parsed.data.phone;
  if (parsed.data.companyName !== undefined) customer.companyName = parsed.data.companyName;
  if (parsed.data.gstNumber !== undefined) customer.gstNumber = parsed.data.gstNumber;
  if (parsed.data.isActive !== undefined) customer.isActive = parsed.data.isActive;
  await customer.save();
  return customer;
}
