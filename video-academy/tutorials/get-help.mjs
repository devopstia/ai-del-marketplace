const SUBJECT = "Video stops halfway through a lesson";
export default {
  id: "get-help", who: "student",
  subtitle: "Open a request, follow the answers, and confirm when it's solved.",
  chips: ["New request", "Statuses", "Email replies"],
  // Demo records: the request this video creates, and leftover automated-test requests, are removed before and after.
  setup: ({ adapter }) => { adapter.sql(`delete from support_tickets where subject in ('${SUBJECT}') or subject like 'E2E help %'`); },
  cleanup: ({ adapter }) => { adapter.sql(`delete from support_tickets where subject = '${SUBJECT}'`); },
  scenes: [
    { type: "title", shotUrl: "/support", lines: ["In this video, you'll learn how to get help from the DEL support team."] },
    { type: "access", path: [["user", "Your account menu"], ["life", "Help and support"]], note: "Also in the footer, and on every receipt.", lines: ["Open Help and support from your account menu, the footer, or Get help with this order on a receipt."] },
    { type: "app", chapter: "Step by step", url: "/support", lines: [
      "Help and support lists your requests and their status. Select New request to ask a question.",
      "Choose a topic, write a short subject, and describe what happened. You can attach up to three screenshots or PDFs.",
      "Select Send. Your request gets a number, and the support team sees your browser and device, so you don't have to explain your setup.",
    ], run: async (h) => {
      await h.show(h.page.locator("main h1").first(), 1000);
      const n = h.page.getByTestId("new-ticket"); await h.show(n, 800); await h.click(n);
      await h.page.waitForURL(/\/support\/new/, { timeout: 15000 }).catch(() => {}); await h.settle();
      await h.line(1);
      const cat = h.page.getByTestId("ticket-category"); await h.moveTo(cat); await cat.selectOption("video_playback"); await h.pause(700);
      await h.type(h.page.getByTestId("ticket-subject"), SUBJECT, 45);
      await h.type(h.page.getByTestId("composer-text"), "The lesson stops after about two minutes and shows an error. It happens in Chrome and Firefox.", 22);
      await h.show(h.text("Attach screenshot or PDF"), 1000);
      await h.line(2);
      const send = h.page.getByTestId("composer-send"); await h.show(send, 600); await h.click(send);
      await h.page.waitForURL(/\/support\/SUP-/, { timeout: 15000 }).catch(() => {}); await h.settle(); await h.pause(600);
      await h.show(h.page.locator("main h1").first(), 1200);
    } },
    { type: "steps", heading: "What happens next", items: [["mail", "We reply", "Here and by email."], ["chat", "Waiting for you", "When we need more details, answer in the request."], ["check", "Resolved", "Confirm it's solved, or say you still need help."]], lines: ["Support replies in the request and by email. If they need more details, it shows Waiting for you. When it's fixed, confirm it's solved, or say you still need help."] },
    { type: "summary", points: ["Help and support", "New request with a topic", "Up to three files", "Replies here and by email", "Confirm or reopen"], next: "Install the app", lines: ["That's it. Your questions now have a home, and you can follow every answer in one place."] },
  ],
};
