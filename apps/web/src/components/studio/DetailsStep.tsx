"use client";
import { useState } from "react";
import type { EditorCtx } from "./CourseEditor";
import { StepFooter } from "./CourseEditor";
import { ListEditor } from "./ListEditor";
import { LANGUAGES } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { RelatedCoursesEditor } from "./RelatedCoursesEditor";

export function DetailsStep({ course, categories, patch, goto, locked }: EditorCtx) {
  const [f, setF] = useState({
    title: course.title, subtitle: course.subtitle, description: course.description, language: course.language && course.language.length <= 3 ? course.language : "en",
    level: course.level, categoryId: course.categoryId ?? "", objectives: course.objectives, requirements: course.requirements,
    taughtBy: course.taughtBy ?? "",
  });
  // DEL Studio only: a DEL course can name the person who teaches it (owner 2026-11-26).
  const { data: isDel } = useApi("/instructor/terms", (r) => Boolean(obj(r).isPlatform));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = async () => {
    setSaving(true);
    const { taughtBy, ...rest } = f;
    const ok = await patch({ ...rest, ...(isDel ? { taughtBy: taughtBy.trim() || null } : {}), categoryId: f.categoryId || undefined, objectives: f.objectives.map((s) => s.trim()).filter(Boolean), requirements: f.requirements.map((s) => s.trim()).filter(Boolean) }, "Details saved.");
    setSaving(false);
    return ok;
  };
  return (
    <>
    <fieldset disabled={locked} className="grid max-w-5xl gap-10 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <div>
          <label className="label" htmlFor="title">Course title</label>
          <input id="title" className="field" maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} />
          <p className="hint">{f.title.length}/120. Say what learners will be able to do, e.g. “Deploy a RAG chatbot on AWS with Bedrock”.</p>
        </div>
        <div>
          <label className="label" htmlFor="subtitle">Subtitle</label>
          <input id="subtitle" className="field" maxLength={200} value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="desc">Description</label>
          <textarea id="desc" className="field min-h-56" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Who is this for, what you’ll build, and what tools you’ll use." />
          <p className="hint">Markdown supported: **bold**, lists with “-”, and headings with “##”.</p>
        </div>
        <ListEditor id="obj" label="What learners will learn" hint="At least four concrete outcomes. Start each with a verb." items={f.objectives} onChange={(v) => set("objectives", v)} placeholder="Deploy a containerised model API behind a load balancer" />
        <ListEditor id="req" label="Requirements" hint="Tools, accounts and prior knowledge learners need." items={f.requirements} onChange={(v) => set("requirements", v)} placeholder="An AWS account with permission to create EC2 instances" />
      </div>
      <div className="space-y-6">
        <div>
          <label className="label" htmlFor="cat">Category</label>
          <select id="cat" className="field" value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Choose a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="level">Level</label>
          <select id="level" className="field" value={f.level} onChange={(e) => set("level", e.target.value as typeof f.level)}>
            <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </select>
        </div>
        {isDel ? (
          <div>
            <label className="label" htmlFor="taught-by">Designed by (name shown)</label>
            <input id="taught-by" className="field" maxLength={80} value={f.taughtBy} onChange={(e) => set("taughtBy", e.target.value)} placeholder="e.g. Tia" data-testid="taught-by-input" />
            <p className="hint">Shown as “Designed by …” on the course page. The course stays DevOps Easy Learning’s. Leave empty to show only DevOps Easy Learning.</p>
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="lang">Language</label>
          <select id="lang" className="field" value={f.language} onChange={(e) => set("language", e.target.value)}>
            {LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
      </div>
      <div className="lg:col-span-2"><StepFooter onSave={save} saving={saving} next="media" goto={goto} disabled={locked} /></div>
    </fieldset>
    {/* Outside the fieldset: related courses aren't course content, so they stay editable while a revision is in review. */}
    <RelatedCoursesEditor courseId={course.id} />
    </>
  );
}
