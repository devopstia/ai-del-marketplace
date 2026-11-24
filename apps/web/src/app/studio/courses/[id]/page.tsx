"use client";
import { Suspense, use } from "react";
import { CourseEditor } from "@/components/studio/CourseEditor";

export default function EditCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense><CourseEditor id={id} /></Suspense>;
}
