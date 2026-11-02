import mongoose from "mongoose";
import { getTenantContext } from "@/lib/tenant/context";

const QUERY_OPERATIONS = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
];

/**
 * Escape hatch for platform-level code (cross-tenant jobs, migrations):
 * `Model.find(filter).setOptions({ skipTenantScope: true })`.
 */
export const SKIP_TENANT_SCOPE = { skipTenantScope: true };

function currentTenantObjectId(modelName, operation) {
  const context = getTenantContext();
  if (!context) {
    throw new Error(`Tenant context missing for ${modelName}.${operation}(). Wrap the call in runWithTenant().`);
  }
  return new mongoose.Types.ObjectId(context.tenantId);
}

function assertSameTenant(documentTenantId, contextTenantId, modelName) {
  if (documentTenantId && String(documentTenantId) !== String(contextTenantId)) {
    throw new Error(`Refusing to write ${modelName} for another tenant.`);
  }
}

/**
 * Adds an immutable `tenantId` to the schema and scopes every query, aggregate
 * and insert to the tenant in the current request context. Operations without
 * a tenant context throw (fail closed).
 *
 * Indexes are declared explicitly in each model and must start with `tenantId`
 * (enforced by tests/unit/tenant-indexes.test.js).
 * @param {mongoose.Schema} schema
 */
export function tenantScopePlugin(schema) {
  schema.add({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", required: true, immutable: true },
  });

  schema.pre(QUERY_OPERATIONS, function scopeQuery() {
    if (this.getOptions().skipTenantScope) return;
    const tenantId = currentTenantObjectId(this.model.modelName, this.op);
    const filter = this.getFilter();
    assertSameTenant(filter.tenantId, tenantId, this.model.modelName);
    this.where({ tenantId });
  });

  schema.pre("aggregate", function scopeAggregate() {
    if (this.options?.skipTenantScope) return;
    const tenantId = currentTenantObjectId(this._model?.modelName ?? "aggregate", "aggregate");
    const pipeline = this.pipeline();
    const first = pipeline[0];
    if (first?.$match) {
      // Merge into the first $match: stages like $text must stay first in the pipeline.
      assertSameTenant(first.$match.tenantId, tenantId, this._model?.modelName ?? "aggregate");
      first.$match = { ...first.$match, tenantId };
    } else {
      pipeline.unshift({ $match: { tenantId } });
    }
  });

  schema.pre("validate", function assignTenant() {
    if (!this.isNew) return;
    const tenantId = currentTenantObjectId(this.constructor.modelName, "save");
    assertSameTenant(this.tenantId, tenantId, this.constructor.modelName);
    this.tenantId = tenantId;
  });

  schema.pre("insertMany", function assignTenantToMany(docs) {
    const tenantId = currentTenantObjectId(this.modelName, "insertMany");
    for (const doc of Array.isArray(docs) ? docs : [docs]) {
      assertSameTenant(doc.tenantId, tenantId, this.modelName);
      doc.tenantId = tenantId;
    }
  });

  schema.pre("bulkWrite", function scopeBulkWrite(operations) {
    const tenantId = currentTenantObjectId(this.modelName, "bulkWrite");
    for (const operation of operations) {
      const [type, body] = Object.entries(operation)[0];
      if (type === "insertOne") {
        body.document.tenantId = tenantId;
      } else {
        body.filter = { ...body.filter, tenantId };
        if (body.upsert && body.update) {
          body.update.$setOnInsert = { ...body.update.$setOnInsert, tenantId };
        }
      }
    }
  });

  schema.static("estimatedDocumentCount", function blockEstimatedCount() {
    throw new Error("estimatedDocumentCount() ignores tenant scope; use countDocuments() instead.");
  });
}
