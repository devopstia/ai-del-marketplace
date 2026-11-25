export default {
  id: "studio-tour", who: "instructor",
  subtitle: "Your earnings, courses, sales and the tools that run your teaching business.",
  chips: ["Home", "Courses", "Sales", "Promotions", "Payouts"],
  scenes: [
    { type: "title", shotUrl: "/studio", lines: ["In this video, you'll take a tour of the DEL instructor studio."] },
    { type: "access", path: [["user", "Your account menu"], ["grad", "Instructor studio"]], lines: ["Open the studio from your account menu, or from Teach on DEL once you're an instructor."] },
    { type: "app", chapter: "Step by step", url: "/studio", lines: [
      "The studio home shows your daily earnings, your latest reviews and your courses.",
      "Courses lists every course with its status: published, unpublished, or changes waiting for review. New course starts a new one.",
      "Sales shows your earnings per day and every transaction, from the last 7 days to 12 months.",
      "Promotions puts a course on sale for a set time. Students, Reviews and Payouts complete the menu, and payouts go to your bank through Stripe.",
    ], run: async (h) => {
      await h.show(h.page.locator("main h1").first(), 1000);
      await h.show(h.text("Daily earnings"), 1300); await h.show(h.text("Latest reviews"), 1300);
      await h.line(1); await h.openTab("/studio/courses"); await h.show(h.link(/new course/i), 1200);
      await h.line(2); await h.openTab("/studio/sales"); const d = h.btn("90 days"); await h.click(d); await h.pause(1400);
      await h.line(3); await h.openTab("/studio/promotions");
      for (const href of ["/studio/students", "/studio/reviews", "/studio/payouts"]) { const l = h.side(href); await h.moveTo(l); await h.ring(l, 4); await h.pause(700); await h.unring(); }
    } },
    { type: "tips", tips: [["chat", "Reply to reviews", "Students notice instructors who answer."], ["sparkle", "Plan a launch sale", "A short discount brings the first students."], ["shield", "Connect Stripe early", "Payouts need a verified account."]], lines: ["A few tips. Reply to your reviews, plan a short launch sale, and connect Stripe early so your payouts aren't delayed."] },
    { type: "summary", points: ["Studio home", "Courses and their status", "Sales and transactions", "Promotions", "Students, Reviews, Payouts"], next: "Create a course", lines: ["That's the studio: your home, your courses, your sales, and the tools around them."] },
  ],
};
