"use client";
import { use } from "react";
import { TestPayment } from "@/components/TestPayment";

export default function TestPaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  return <TestPayment orderId={orderId} />;
}
