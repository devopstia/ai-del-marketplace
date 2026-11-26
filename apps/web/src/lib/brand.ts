/**
 * Course branding (owner 2026-11-26; API `common/brand.ts`). Courses by DEL and by Official DevOps Easy Learning
 * Instructors carry `instructor.brand = "DevOps Easy Learning"`: listings show the brand, the course page adds
 * "Taught by <name>". Independent instructors' courses have no brand and show their own name.
 */
export const OFFICIAL_LABEL = "Official DevOps Easy Learning Instructor";

/** Who a course is "by" on cards, cart, checkout and search. */
export const courseBy = (i: { name: string; brand?: string | null }) => i.brand || i.name;

/** True when the brand differs from the person (an official instructor's course), so "Taught by" is worth showing. */
export const taughtBy = (i: { name: string; brand?: string | null }) => (i.brand && i.brand !== i.name ? i.name : null);
