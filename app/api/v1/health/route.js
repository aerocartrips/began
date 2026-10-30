import { withApiHandler, successResponse } from "@/lib/utils/api-response";
import { connectDB, getConnectionState, isDatabaseConfigured } from "@/lib/db/connect";

export const GET = withApiHandler(async () => {
  if (!isDatabaseConfigured()) {
    return successResponse(
      { database: "not_configured", state: "disconnected" },
      "API is running. Database is not configured.",
    );
  }

  await connectDB();
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return successResponse(
    {
      database: "configured",
      state: stateMap[getConnectionState()] ?? "unknown",
    },
    "Health check successful.",
  );
});
