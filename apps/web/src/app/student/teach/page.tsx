"use client";
import { PageHead } from "@/components/shell/AppShell";
import { ApplyToTeach } from "@/components/ApplyToTeach";

export default function TeachApplication() {
  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <PageHead title="Become an instructor" sub="Teach what you run in production. DevOps Easy Learning reviews every application and replies by email." />
        <ol className="space-y-3 text-sm text-ink-2">
          {["Tell us about your background and the courses you plan.", "DEL reviews it, usually within two working days, and may ask a question.", "Once approved, the Instructor Studio appears in your studio switcher. You keep your courses and progress as a student."].map((t, i) => (
            <li key={i} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet-soft text-xs font-bold text-violet">{i + 1}</span>{t}</li>
          ))}
        </ol>
      </div>
      <ApplyToTeach next="/student/teach" />
    </div>
  );
}
