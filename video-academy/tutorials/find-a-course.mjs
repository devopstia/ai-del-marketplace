export default {
  id: "find-a-course", who: "anon",
  subtitle: "Search the catalogue, open a course, and watch a free lesson before you buy.",
  chips: ["Search", "Course page", "Free preview"],
  scenes: [
    { type: "title", shotUrl: "/courses", lines: ["In this video, you'll learn how to find the right course on DevOps Easy Learning, and how to look inside a course before you buy it."] },
    { type: "app", chapter: "Browse and search", url: "/courses", lines: [
      "Browse courses lists every course, with its price and a short description of what you'll build.",
      "To find a topic, type it in the search box at the top. For example, agents.",
    ], run: async (h) => {
      await h.show(h.page.locator("main h1").first(), 1200);
      await h.glide(380, 1800); await h.top();
      await h.line(1);
      const box = h.page.getByPlaceholder(/search/i).first();
      await h.type(box, "agents", 110); await h.pause(400); await h.page.keyboard.press("Enter");
      await h.settle(); await h.pause(900);
      await h.show(h.page.locator("main a[href^='/courses/']").first(), 1200);
    } },
    { type: "app", chapter: "The course page", url: "/courses/ai-for-devops", lines: [
      "A course page shows everything it includes: what you'll learn, the full list of lessons, and who teaches it.",
      "Lessons marked Preview are free. Select Preview this course to watch one before you buy.",
    ], run: async (h) => {
      await h.show(h.page.locator("main h1").first(), 1400);
      await h.show(h.text("What you’ll learn"), 1200);
      await h.glide(520, 1600); await h.show(h.text("Course content"), 1200);
      await h.line(1); await h.top();
      const pv = h.btn(/preview this course/i);
      await h.show(pv, 900); await h.click(pv); await h.pause(3500);
      await h.page.keyboard.press("Escape").catch(() => {});
    } },
    { type: "tips", tips: [["search", "Search by tool or skill", "Kubernetes, Terraform, MCP or RAG."], ["video", "Watch a preview first", "Free lessons are marked Preview."], ["star", "Look for deals", "Courses on sale show the regular price crossed out."]], lines: ["A few tips. Search by the tool or skill you need, watch a free preview first, and look at Deals for courses on sale."] },
    { type: "summary", points: ["Browse courses", "Search from the top bar", "What you'll learn and the lessons", "Free previews"], next: "Learn in the course player", lines: ["That's it. You found a course, checked what it includes, and watched a free lesson."] },
  ],
};
