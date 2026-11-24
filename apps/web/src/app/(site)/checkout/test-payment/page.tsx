"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TestPayment } from "@/components/TestPayment";

function Inner() {
  const order = useSearchParams().get("order") ?? "";
  return order ? <TestPayment orderId={order} /> : <p className="container-x pt-12 text-ink-2">No order was given.</p>;
}

/** The API's dev checkout URL: /checkout/test-payment?order=<id>. */
export default function TestPaymentQueryPage() {
  return <Suspense><Inner /></Suspense>;
}
