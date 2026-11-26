/**
 * Course branding (owner 2026-11-26). DEL's own courses (the platform account) and courses by Official DevOps Easy
 * Learning Instructors are shown under the DEL brand; independent instructors' courses never are. Branding only:
 * money (rate, payee, Stripe transfers) is decided elsewhere and is not affected.
 */
export const DEL_BRAND = 'DevOps Easy Learning';

export type BrandProfile = { isPlatform?: boolean | null; official?: boolean | null } | null | undefined;

/** "DevOps Easy Learning" for DEL and its official instructors, otherwise null (the course is shown under the instructor's name). */
export const brandOf = (p: BrandProfile): string | null => (p?.isPlatform || p?.official ? DEL_BRAND : null);

/** True only for an Official DEL Instructor (not DEL's own platform account). */
export const isOfficial = (p: BrandProfile): boolean => !p?.isPlatform && !!p?.official;

/** Prisma select for the fields above. */
export const brandSelect = { isPlatform: true, official: true } as const;
