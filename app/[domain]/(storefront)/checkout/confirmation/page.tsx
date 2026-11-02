"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SuccessCard from "@/components/ui/feedback/success-card";
import Button from "@/components/ui/button";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber")?.trim() || "";

  return (
    <SuccessCard
      title="Order placed successfully"
      description="Your payment was verified on our servers and the order is now marked as paid. Fulfillment updates will follow separately."
      detail={
        orderNumber ? (
          <p>
            Order number: <strong>{orderNumber}</strong>
          </p>
        ) : (
          <p>You can find the order number in your account order history.</p>
        )
      }
      action={
        <>
          <Button href="/products">Continue shopping</Button>
          <Link className="text-button" href="/account/orders">
            View my orders
          </Link>
        </>
      }
    />
  );
}

export default function CheckoutConfirmationPage() {
  return (
    <main className="commerce-page content-width">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Payment confirmed</p>
          <h1>Thank you for your order</h1>
        </div>
      </div>
      <Suspense
        fallback={
          <SuccessCard
            title="Order placed successfully"
            description="Loading your order details…"
            detail={null}
            action={<Button href="/products">Continue shopping</Button>}
          />
        }
      >
        <ConfirmationContent />
      </Suspense>
    </main>
  );
}
