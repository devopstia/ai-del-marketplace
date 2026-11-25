/**
 * The DevOps Easy Learning full training program, promoted on the marketplace (owner, 2026-11-25).
 * Enrolment and payment happen only on devopseasylearning.com, never through the marketplace checkout.
 * The www host is used because the site's HTTPS certificate covers www.devopseasylearning.com only
 * (the bare domain shows a certificate error). Facts are from the program page (checked 2026-11-25).
 */
export const DEL_SITE = "https://www.devopseasylearning.com";
export const DEL_PROGRAM = {
  name: "AI-Native Cloud DevOps Engineer",
  /** Enrollment Application form */
  enrollUrl: `${DEL_SITE}/registration/`,
  /** Program overview: curriculum, format, outcomes */
  aboutUrl: `${DEL_SITE}/ai-native-cloud-devops-engineer/`,
  facts: [
    "8 months of live online weekend classes",
    "21 modules: Linux and scripting to Kubernetes, Terraform and LLMOps",
    "Capstone projects and an engineering internship",
    "First month free, no obligation",
  ],
} as const;

/** UTM tags so DEL can see visits that came from the marketplace. */
export const programLink = (url: string, placement: string) =>
  `${url}?utm_source=del-marketplace&utm_medium=referral&utm_campaign=full-program&utm_content=${encodeURIComponent(placement)}`;
