import mongoose from "mongoose";

const jobRunSchema = new mongoose.Schema(
  {
    jobName: { type: String, required: true, trim: true, index: true },
    status: { type: String, enum: ["running", "success", "failed"], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    processedCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    errorSummary: { type: String, trim: true, maxlength: 2000, default: "" },
    triggeredBy: { type: String, trim: true, maxlength: 40, default: "scheduler" },
  },
  { timestamps: false },
);

jobRunSchema.index({ jobName: 1, startedAt: -1 });

export const JobRun = mongoose.models.JobRun ?? mongoose.model("JobRun", jobRunSchema);
