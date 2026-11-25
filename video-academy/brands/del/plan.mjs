// Every help video DEL needs (owner 2026-11-25). A tutorial spec in tutorials/<id>.mjs turns a plan entry into a video.
const E = (category, order, id, title, short, audience, feature, scenario, description, extra = {}) => ({ category, order, id, title, short, audience, feature, scenario, description, ...extra });

export const PLAN = [
  E("getting-started", 1, "find-a-course", "How to find the right course on DEL", "Find the right course", "students", "Browse courses, search, course page, preview", "A DevOps engineer looks for a RAG course and watches a free lesson", "Search the catalogue, open a course, see what it includes and watch a free preview."),
  E("getting-started", 2, "welcome-tour", "Welcome to DevOps Easy Learning: a quick tour", "Welcome to DEL", "everyone", "Home, courses, deals, my learning, studio", "A first visit", "What DEL is and where everything lives."),
  E("learning", 1, "learn-in-the-player", "How to learn in the course player", "Learn in the course player", "students", "My learning, player, captions, speed, notes, course content", "A student resumes a course on a lunch break", "Resume a course, use the player controls and captions, keep notes and move between lessons."),
  E("learning", 2, "quizzes-and-certificates", "Quizzes, progress and your certificate", "Quizzes and certificates", "students", "Lesson quizzes, progress, certificate, verification", "Finishing a course", "Check what you learned, follow your progress and get a certificate anyone can verify."),
  E("buying", 1, "buy-a-course", "How to buy a course", "Buy a course", "students", "Cart, checkout, receipt", "Buying a course on sale", "Add a course to your cart, pay securely and find your receipt."),
  E("buying", 2, "receipts-and-refunds", "Receipts and refunds", "Receipts and refunds", "students", "Orders, receipts, refund request", "Asking for a refund within the refund window", "Find your receipts and request a refund."),
  E("teaching", 1, "studio-tour", "A tour of the instructor studio", "Tour the instructor studio", "instructors", "Studio home, courses, sales, promotions, students, reviews, payouts", "An instructor checks the week", "Your earnings, courses, sales and the tools that run your teaching business."),
  E("teaching", 2, "create-a-course", "How to create and publish a course", "Create a course", "instructors", "New course, curriculum, uploads, review", "Publishing a first course", "Plan the course, upload lessons, pick a cover and send it for review."),
  E("teaching", 3, "sales-and-promotions", "How to run a sale on your course", "Run a sale", "instructors", "Promotions", "A two-week launch discount", "Schedule a discount, see it on the course and track the results."),
  E("account", 1, "get-help", "How to get help from DEL support", "Get help from support", "everyone", "Help and support, new request, statuses", "A video won't play", "Open a request, follow the answers and confirm when it's solved."),
  E("account", 2, "install-the-app", "Install DEL on your phone or computer", "Install the app", "everyone", "Install page", "Studying on the phone", "Add DEL to your home screen or desktop, on any device."),
];
