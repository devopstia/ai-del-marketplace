export default {
  id: "learn-in-the-player", who: "student",
  subtitle: "Resume a course, use the player and captions, keep notes, and move between lessons.",
  chips: ["Resume", "Speed", "Captions", "Notes"],
  scenes: [
    { type: "title", shotUrl: "/my-learning", lines: ["In this video, you'll learn how to study in the DEL course player."] },
    { type: "app", chapter: "My learning", url: "/my-learning", lines: [
      "My learning shows your courses and your progress. Select Resume to continue exactly where you stopped.",
    ], run: async (h) => {
      await h.show(h.page.locator("main h1").first(), 900);
      const r = h.link(/resume/i); await h.show(r, 1200); await h.click(r);
      await h.page.waitForURL(/\/learn\//, { timeout: 15000 }).catch(() => {}); await h.settle();
    } },
    { type: "app", chapter: "The player", from: "/my-learning", lines: [
      "The player has the controls you expect: play and pause, back or forward ten seconds, and the speed, from 0.75 to 2 times.",
      "Captions are off until you turn them on. Select CC to show them, and DEL remembers your choice.",
      "Under the video, Overview describes the lesson, and Notes keeps your own notes for it.",
      "Course content shows every lesson and what you've finished. When a lesson ends, the next one starts by itself.",
    ], run: async (h) => {
      const res = h.page.locator("main").getByRole("link", { name: /resume/i }).first();
      await res.click().catch(() => {}); await h.page.waitForURL(/\/learn\//, { timeout: 15000 }).catch(() => {}); await h.settle(); await h.pause(1200);
      const player = h.page.getByTestId("video-player");
      await h.moveTo(player); await h.pause(800);
      await h.show(h.btn(/back 10 seconds/i), 700, 4); await h.show(h.btn(/forward 10 seconds/i), 700, 4);
      const sp = h.btn(/playback speed/i); await h.click(sp); await h.pause(700);
      const opt = h.page.getByRole("menuitemradio", { name: /1\.25/ }); await h.click(opt); await h.pause(600);
      await h.line(1);
      const cc = h.btn(/^captions$/i); await h.show(cc, 700, 4); await h.click(cc); await h.pause(2600); await h.click(cc); await h.pause(500);
      await h.line(2);
      await h.show(h.page.getByRole("tab", { name: "Overview" }), 900, 4);
      const notes = h.page.getByRole("tab", { name: "Notes" }); await h.click(notes); await h.pause(1400);
      await h.line(3);
      await h.show(h.page.locator("aside").getByText("Course content").first(), 1300);
      await h.show(h.page.getByRole("button", { name: /^next$/i }).first(), 1000, 4);
    } },
    { type: "tips", tips: [["clock", "Short sessions work", "Ten minutes a day keeps your streak going."], ["headphones", "Turn on captions", "Handy in a noisy place or a second language."], ["paper", "Write a note", "Your notes stay with each lesson."]], lines: ["A few tips. Short sessions work well, captions help in a noisy place, and a quick note makes a lesson easier to review."] },
    { type: "summary", points: ["Resume from My learning", "Speed and ten-second jumps", "Captions, off by default", "Overview and Notes", "Course content and autoplay"], next: "Get help from support", lines: ["Let's recap. You resumed a course, used the player and captions, and found your notes and the course content."] },
  ],
};
