import Link from "next/link";
import StatCard from "@/components/admin/stat-card";
import { products } from "@/data/products";

export default function AdminOverviewPage() {
  return (
    <>
      <header className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Store overview</p>
          <h1>Overview</h1>
          <p>Business data is shown only when connected to its source.</p>
        </div>
      </header>
      <section className="admin-stat-grid" aria-label="Store statistics">
        <StatCard label="Products" value={String(products.length)} detail="From the current static catalog" />
        <StatCard label="Orders" value="Not connected" detail="No order database configured" state="unavailable" />
        <StatCard label="Paid revenue" value="Not connected" detail="No verified payment records" state="unavailable" />
        <StatCard label="Failed payments" value="Not connected" detail="No payment provider configured" state="unavailable" />
        <StatCard label="Customer messages" value="Not connected" detail="No message storage configured" state="unavailable" />
        <StatCard label="Inventory alerts" value="Unavailable" detail="No stock threshold is configured" state="unavailable" />
      </section>
      <section className="admin-panel admin-source-panel">
        <div>
          <p className="admin-eyebrow">Current data boundary</p>
          <h2>This storefront has no order or customer backend yet</h2>
          <p>
            Product management is read-only while the catalog lives in source code. Orders, payments,
            customer messages, and analytics will appear here after their services are connected.
          </p>
        </div>
        <Link className="admin-text-link" href="/admin/products">Review catalog</Link>
      </section>
    </>
  );
}