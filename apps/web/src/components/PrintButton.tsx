"use client";
import { Printer } from "lucide-react";
export function PrintButton() {
  return <button type="button" className="btn btn-outline" onClick={() => window.print()}><Printer className="size-4" />Print or save as PDF</button>;
}
