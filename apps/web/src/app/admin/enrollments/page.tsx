"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHead, Kpis } from "@/components/shell/AppShell";
import { EnrollmentForm } from "@/components/enrollments/EnrollmentForm";
import { RequestList } from "@/components/enrollments/RequestList";
import { useAuth } from "@/components/AuthProvider";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";

/** Super Admin Studio › People › Manual enrollments: approve instructor requests, verify payments, enroll directly. */
export default function AdminEnrollments() {
  const { has } = useAuth();
  const superAdmin = has("super_admin");
  const [creating, setCreating] = useState(false);
  const [k, setK] = useState(0);
  const earn = useApi(superAdmin ? `/enrollments/earnings?k=${k}` : null, (r) => obj(obj(r).totals) as Record<string, number>);
  return (
    <div className="max-w-[1600px]">
      <PageHead title="Manual enrollments" sub="Students who pay outside the checkout. Verify the payment (or record a complimentary reason), then approve: existing accounts get the courses at once, new students get an invitation."
        actions={superAdmin ? (!creating ? <button type="button" className="btn btn-primary" onClick={() => setCreating(true)} data-testid="new-enrollment"><Plus className="size-4" />Enroll a student</button> : <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Back to requests</button>) : null} />
      {creating ? <EnrollmentForm mode="super_admin" onDone={() => { setCreating(false); setK((x) => x + 1); }} /> : (
        <>
          {earn.data ? (
            <div className="mb-8"><Kpis items={[
              { label: "Verified external payments (net)", value: moneyExact(earn.data.netUsdCents ?? 0) },
              { label: "Instructor earnings", value: moneyExact(earn.data.instructorCents ?? 0) },
              { label: "Payouts to make", value: moneyExact(earn.data.payoutPendingCents ?? 0), note: "Recorded by hand, never through Stripe" },
              { label: "DEL share", value: moneyExact(earn.data.platformCents ?? 0) },
            ]} /></div>
          ) : null}
          <RequestList mode={superAdmin ? "super_admin" : "viewer"} refreshKey={k} />
        </>
      )}
    </div>
  );
}
