import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";

const jobRunSchema = new mongoose.Schema(
  {
    jobName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["running", "success", "failed"], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    processedCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    errorSummary: { type: String, trim: true, maxlength: 2000, default: "" },
    triggeredBy: { type: String, trim: true, maxlength: 40, default: "scheduler" },
    /** Set while a job that must not overlap is running; cleared when it finishes. */
    lockKey: { type: String, trim: true, maxlength: 60 },
  },
  { timestamps: false },
);

jobRunSchema.index({ tenantId: 1, jobName: 1, startedAt: -1 });
// One running lock per job per store (lib/jobs/product-metrics.job.js).
jobRunSchema.index({ tenantId: 1, lockKey: 1 }, { unique: true, partialFilterExpression: { lockKey: { $type: "string" } } });

jobRunSchema.plugin(tenantScopePlugin);

export const JobRun = mongoose.models.JobRun ?? mongoose.model("JobRun", jobRunSchema);
