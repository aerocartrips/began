"use client";

import Link from "next/link";
import { Suspense } from "react";
import SuccessCard from "@/components/ui/feedback/SuccessCard";
import PageLoader from "@/components/ui/loaders/PageLoader";
import Button from "@/components/ui/button";

type ConfirmationContentProps = {
  searchParams: Promise<{ orderNumber?: string | string[] }>;
};

async function ConfirmationContent({ searchParams }: ConfirmationContentProps) {
  const params = await searchParams;
  const orderNumber = Array.isArray(params.orderNumber) ? params.orderNumber[0] : params.orderNumber;

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
          <Link className="text-button" href="/account/login">
            View account
          </Link>
        </>
      }
    />
  );
}

export default function CheckoutConfirmationPage(props: ConfirmationContentProps) {
  return (
    <main className="commerce-page content-width">
      <div className="commerce-heading">
        <div>
          <p className="eyebrow">Payment confirmed</p>
          <h1>Thank you for your order</h1>
        </div>
      </div>
      <Suspense fallback={<PageLoader label="Loading confirmation" />}>
        <ConfirmationContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
