import { PERMISSIONS } from "@/lib/auth/permissions";
import Link from "next/link";
import { connection } from "next/server";
import StatCard from "@/components/admin/stat-card";
import { connectDB, isDatabaseConfigured } from "@/lib/db/connect";
import { getAdminDashboardStats } from "@/lib/services/dashboard.service";
import { logger } from "@/lib/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { withCurrentTenant } from "@/lib/tenant/current";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numbers = new Intl.NumberFormat("en-IN");

async function loadStats() {
  if (!isDatabaseConfigured()) return null;
  await connection();
  try {
    await connectDB();
    return await withCurrentTenant(async () => {
      await requireAdmin(PERMISSIONS.DASHBOARD_VIEW);
      return getAdminDashboardStats();
    });
  } catch (error) {
    unstable_rethrow(error);
    logger.error("Admin dashboard stats failed", { error });
    return null;
  }
}

export default async function AdminOverviewPage() {
  const stats = await loadStats();

  return (
    <>
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Store overview</p>
          <h1>Overview</h1>
          <p>Live figures from the store database.</p>
        </div>
      </header>
      {stats ? (
        <section className="admin-stat-grid" aria-label="Store statistics">
          <StatCard
            label="Products"
            value={numbers.format(stats.activeProducts)}
            detail={`Active of ${numbers.format(stats.totalProducts)} in catalog`}
          />
          <StatCard label="Orders" value={numbers.format(stats.orders)} detail="All orders placed" />
          <StatCard label="Paid revenue" value={rupees.format(stats.paidRevenue)} detail={`${numbers.format(stats.paidOrders)} paid orders, net of refunds`} />
          <StatCard label="Failed payments" value={numbers.format(stats.failedPayments)} detail="Payment attempts that failed" />
          <StatCard label="Customer messages" value={numbers.format(stats.openConversations)} detail="Open support conversations" />
          <StatCard
            label="Inventory alerts"
            value={numbers.format(stats.lowStock)}
            detail={`Active products with ${stats.lowStockThreshold} or fewer in stock`}
          />
        </section>
      ) : (
        <section className="admin-panel admin-source-panel">
          <div>
            <p className="admin-eyebrow">Database unavailable</p>
            <h2>Store figures could not be loaded</h2>
            <p>Configure MONGODB_URI and confirm the database is reachable to see orders, payments, and inventory.</p>
          </div>
          <Link className="admin-text-link" href="/admin/settings">Check integrations</Link>
        </section>
      )}
    </>
  );
}
