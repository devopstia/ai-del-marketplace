export default {
  id: "install-the-app", who: "student",
  subtitle: "Add DEL to your home screen or desktop, on any device.",
  chips: ["Phone", "Tablet", "Computer"],
  scenes: [
    { type: "title", shotUrl: "/install", lines: ["In this video, you'll learn how to install DEL on your phone or computer, so it opens like an app."] },
    { type: "why", heading: "Why <span class=\"hl\">install</span> it", lead: "It's the same DEL, without the browser around it.", cards: [["phone", "One tap away", "On your home screen or dock."], ["laptop", "Its own window", "Full screen for your lessons."], ["shield", "Nothing to download", "No app store, always up to date."]], lines: ["Installing puts DEL on your home screen or dock. It opens in its own window, and there's no app store and nothing to update."] },
    { type: "app", chapter: "Step by step", url: "/install", lines: [
      "Install the app is in the footer of every page, and in your account menu. The page shows the steps for the device you're using.",
      "On a computer, scan the code with your phone's camera to open this page there.",
      "The steps for every device are listed: iPhone and iPad, Android, Windows, Mac, Linux and ChromeOS.",
    ], run: async (h) => {
      await h.show(h.page.locator("main h1").first(), 1200);
      await h.show(h.text("On this computer"), 1600);
      await h.line(1); await h.show(h.text("On your phone"), 2200);
      await h.line(2);
      for (const n of ["iPhone and iPad", "Android", "Windows"]) { const b = h.btn(n); await h.click(b); await h.pause(1300); }
    } },
    { type: "phone", heading: "On an iPhone", steps: [["Open DEL in Safari", "Sign in as usual."], ["Select Share", "The square with an arrow."], ["Add to Home Screen", "Then select Add."]], lines: ["On an iPhone, open DEL in Safari, select Share, then Add to Home Screen.", "On Android, open it in Chrome and select Install app from the menu."] },
    { type: "summary", points: ["Footer or account menu", "Steps for your device", "QR code from a computer", "iPhone: Share, Add to Home Screen", "Android: Install app"], next: "Get help from support", lines: ["That's it. DEL is now one tap away on any of your devices."] },
  ],
};
