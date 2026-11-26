"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHead, Kpis } from "@/components/shell/AppShell";
import { EnrollmentForm } from "@/components/enrollments/EnrollmentForm";
import { RequestList } from "@/components/enrollments/RequestList";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { moneyExact } from "@/lib/format";

/** Instructor Studio › Manual enrollments: students who paid outside the checkout (owner 2026-11-25). */
export default function InstructorEnrollments() {
  const [creating, setCreating] = useState(false);
  const [k, setK] = useState(0);
  const earn = useApi(`/enrollments/earnings?k=${k}`, (r) => obj(obj(r).totals) as Record<string, number>);
  return (
    <div className="max-w-[1600px]">
      <PageHead title="Manual enrollments" sub="For students who paid you outside the checkout (mobile money, bank transfer…). Choose your courses and send the request; DevOps Easy Learning verifies the payment, approves it and invites the student."
        actions={!creating ? <button type="button" className="btn btn-primary" onClick={() => setCreating(true)} data-testid="new-enrollment"><Plus className="size-4" />New enrollment request</button> : <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Back to requests</button>} />
      {creating ? <EnrollmentForm mode="instructor" onDone={() => { setCreating(false); setK((x) => x + 1); }} /> : (
        <>
          {earn.data && earn.data.instructorCents ? (
            <div className="mb-8"><Kpis items={[
              { label: "Your earnings (manual)", value: moneyExact(earn.data.instructorCents ?? 0), note: "80% of the net of verified payments" },
              { label: "Waiting for payout", value: moneyExact(earn.data.payoutPendingCents ?? 0) },
              { label: "Paid out", value: moneyExact(earn.data.paidOutCents ?? 0) },
              { label: "DEL share", value: moneyExact(earn.data.platformCents ?? 0) },
            ]} /></div>
          ) : null}
          <RequestList mode="instructor" refreshKey={k} />
        </>
      )}
    </div>
  );
}
