// Shapes the web app works with. Raw API payloads pass through the normalizers in normalize.ts first,
// so small differences in the API's field names do not leak into components.

export type Role = "student" | "instructor" | "admin" | "super_admin";
export type Level = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "in_review" | "changes_requested" | "published" | "unpublished" | "rejected";

export interface Me {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  roles: Role[];
  status?: string;
  instructorStatus?: "pending" | "approved" | "rejected" | null;
  createdAt?: string;
  /** Super admin working in the studio as DEL ("DEL Studio"); null otherwise. */
  actingAs?: { id: string; name: string } | null;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  icon?: string | null;
  courseCount?: number;
}

export interface InstructorSummary {
  id: string;
  name: string;
  headline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  website?: string | null;
  courseCount?: number;
  studentCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
}

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  thumbnailUrl?: string | null;
  instructor: { id: string; name: string };
  priceCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  studentCount: number;
  totalDurationSec: number;
  lectureCount?: number;
  level: Level;
  category?: { slug: string; name: string } | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LectureOutline {
  id: string;
  title: string;
  type: "video" | "article" | "quiz";
  durationSec: number;
  isPreview: boolean;
  position?: number;
  completed?: boolean;
  positionSec?: number;
  hasResources?: boolean;
  hasQuiz?: boolean;
  articleMd?: string | null;
  description?: string | null;
}

export interface SectionOutline {
  id: string;
  title: string;
  position?: number;
  lectures: LectureOutline[];
}

export interface CourseDetail extends CourseCard {
  description: string;
  language: string;
  objectives: string[];
  requirements: string[];
  instructor: InstructorSummary;
  sections: SectionOutline[];
  enrolled?: boolean;
  inCart?: boolean;
  isOwner?: boolean;
  hasPromo?: boolean;
  /** Downloadable files across the course; "Downloadable lab files" is shown only when > 0. */
  resourceCount: number;
  /** True when the server already answered for a signed-in visitor (enrolled/inCart are then authoritative). */
  viewerSignedIn: boolean;
  hasCaptions: boolean;
}

export interface Review {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  user: { name: string; avatarUrl?: string | null };
  instructorReply?: string | null;
  course?: { slug: string; title: string } | null;
  status?: string;
}

export interface ReviewSummary {
  items: Review[];
  ratingAvg: number;
  ratingCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface CartItem {
  courseId: string;
  course: CourseCard;
}

export interface Cart {
  items: CartItem[];
  totalCents: number;
  currency: string;
}

export interface OrderLine {
  id: string;
  courseId: string;
  title: string;
  slug?: string;
  priceCents: number;
  instructorName?: string;
  refundedAt?: string | null;
}

export interface Order {
  id: string;
  status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  totalCents: number;
  currency: string;
  createdAt: string;
  paidAt?: string | null;
  lines: OrderLine[];
  user?: { id: string; name: string; email: string } | null;
  lineCount?: number;
}

export interface LearningItem {
  course: CourseCard;
  progressPct: number;
  completedLectures?: number;
  totalLectures?: number;
  lastLectureId?: string | null;
  lastLectureTitle?: string | null;
  lastActivityAt?: string | null;
  certificateCode?: string | null;
}

export interface Playback {
  url: string;
  format?: "mp4" | "hls";
  expiresAt?: string;
  captionsUrl?: string | null;
  positionSec?: number;
}

export interface ResourceItem {
  id: string;
  title: string;
  sizeBytes: number;
  mime: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  correct?: number;
  why?: string;
}

export interface Quiz {
  id: string;
  questions: QuizQuestion[];
  lastAttempt?: { score: number; at: string } | null;
}

export interface Session {
  id: string;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: string;
  expiresAt?: string;
  current?: boolean;
}

export interface Certificate {
  code: string;
  issuedAt: string;
  user: { name: string };
  course: { title: string; slug: string; instructorName?: string; totalDurationSec?: number };
}

/* Instructor studio */
export interface StudioLecture {
  id: string;
  title: string;
  type: "video" | "article" | "quiz";
  position: number;
  durationSec: number;
  isPreview: boolean;
  videoAssetId?: string | null;
  videoStatus?: "uploading" | "processing" | "ready" | "failed" | null;
  articleMd?: string | null;
  resources?: ResourceItem[];
  quiz?: { questions: QuizQuestion[] } | null;
}

export interface StudioSection {
  id: string;
  title: string;
  position: number;
  lectures: StudioLecture[];
}

export interface StudioCourse {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  language: string;
  level: Level;
  categoryId?: string | null;
  category?: { slug: string; name: string } | null;
  objectives: string[];
  requirements: string[];
  priceCents: number;
  currency: string;
  thumbnailUrl?: string | null;
  thumbnailKey?: string | null;
  promoVideoAssetId?: string | null;
  status: CourseStatus;
  reviewNote?: string | null;
  sections: StudioSection[];
  studentCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  lectureCount?: number;
  updatedAt?: string;
  instructor?: { id: string; name: string } | null;
  /** Which content the editor shows: the live course, or the draft changes of a published course. */
  version?: "live" | "draft";
  /** Open draft changes of a published course (null when there are none). */
  revision?: StudioRevision | null;
  promoVideo?: { id: string; status: "uploading" | "processing" | "ready" | "failed" } | null;
}

export interface StudioRevision {
  id: string;
  status: "draft" | "in_review" | "changes_requested";
  reviewNote: string | null;
  submittedAt: string | null;
  changes: { area: string; kind: string; message: string }[];
}

export interface SaleRow {
  id: string;
  at: string;
  courseTitle: string;
  buyerName?: string;
  priceCents: number;
  instructorShareCents: number;
  transferStatus?: string;
  feeCents: number;
  netCents: number;
  payee: "instructor" | "platform" | "del_agreement";
  transferDueAt: string | null;
  refundedAt: string | null;
  disputeStatus: string | null;
}

export interface SalesReport {
  feesCents: number;
  heldCents: number;
  totalCents: number;
  instructorShareCents: number;
  count: number;
  rows: SaleRow[];
  series?: { date: string; cents: number }[];
}

export interface StudentRow {
  id: string;
  name: string;
  email?: string;
  courseTitle: string;
  enrolledAt: string;
  progressPct?: number;
}

export interface StripeStatus {
  /** False until the platform's Stripe keys are configured: onboarding is not possible yet. */
  stripeConfigured: boolean;
  pendingPayoutCents: number;
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted?: boolean;
  accountId?: string | null;
  isPlatform?: boolean;
}

/* Admin */
export interface AdminStats {
  users: number;
  instructors: number;
  courses: number;
  publishedCourses: number;
  pendingReviews: number;
  pendingInstructors: number;
  revenueCents: number;
  orders: number;
  enrollments: number;
  platformRevenueCents?: number;
  refundedCents?: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: "active" | "suspended";
  createdAt: string;
}

export interface AdminInstructor {
  userId: string;
  name: string;
  email: string;
  headline?: string | null;
  status: "pending" | "approved" | "rejected";
  payoutsEnabled?: boolean;
  courseCount?: number;
  createdAt?: string;
  isPlatform?: boolean;
  /** platform share override in basis points (null = default) */
  commissionBps?: number | null;
  payToPlatform?: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor?: { id: string; name: string; email?: string } | null;
  targetType: string;
  targetId: string;
  ip?: string | null;
  meta?: unknown;
  at: string;
}
