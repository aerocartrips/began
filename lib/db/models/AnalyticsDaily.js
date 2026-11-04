import mongoose from "mongoose";
import { tenantScopePlugin } from "@/lib/db/plugins/tenant-scope";
import { ANALYTICS_EVENTS, ANALYTICS_RETENTION_DAYS } from "@/lib/constants/analytics";

/** Daily counter for one storefront event (lib/services/analytics.service.js). */
const analyticsDailySchema = new mongoose.Schema(
  {
    /** UTC midnight. */
    day: { type: Date, required: true },
    event: { type: String, enum: ANALYTICS_EVENTS, required: true },
    /** Home page section key, or "" for events outside the home page. */
    section: { type: String, default: "", maxlength: 40 },
    /** Banner id, category or product slug, or link path; "" when not applicable. */
    target: { type: String, default: "", maxlength: 120 },
    count: { type: Number, default: 0, min: 0 },
  },
  { versionKey: false },
);

analyticsDailySchema.index({ tenantId: 1, day: 1, event: 1, section: 1, target: 1 }, { unique: true });
analyticsDailySchema.index({ day: 1 }, { expireAfterSeconds: ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 });
analyticsDailySchema.plugin(tenantScopePlugin);

export const AnalyticsDaily = mongoose.models.AnalyticsDaily ?? mongoose.model("AnalyticsDaily", analyticsDailySchema);
