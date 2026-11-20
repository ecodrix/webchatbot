/**
 * The loader: the one-line embed (`data-erix`), the CONFIG handshake with the
 * chat frame (bubble hidden until then, 3 s fallback), PAGE context, the
 * origin + window checks on every message, and focus in/out.
 *
 * Vitest globals (see vitest.config.mjs); outside tsconfig's `src` on purpose,
 * since this package has no vitest types installed.
 */

const FRAME_ORIGIN = "https://console.ecodrix.com";

/**
 * No launcher route (an older server, or offline): the loader falls back to
 * the 2.3 way, frame preloaded. Synchronous on purpose, so the legacy tests
 * below see the iframe right after init.
 */
const offline = () => {
  throw new Error("offline");
};

/** A fresh copy of the module, run as if from `<script data-erix=…>`. */
async function load(script?: { erix?: string }, fetchImpl: unknown = offline) {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchImpl);
  let el: HTMLScriptElement | null = null;
  if (script) {
    el = document.createElement("script");
    if (script.erix !== undefined) el.dataset.erix = script.erix;
  }
  Object.defineProperty(document, "currentScript", {
    value: el,
    configurable: true,
  });
  const mod = await import("../src/index");
  delete (document as { currentScript?: unknown }).currentScript;
  return mod;
}

const bubbles = () => document.querySelectorAll<HTMLElement>("[data-ecodrix-bubble]");
const bubble = () => bubbles()[0];
const container = () => bubble().parentElement as HTMLElement;
const nudge = () => document.querySelector<HTMLElement>("[data-ecodrix-nudge]");
const iframe = () => document.querySelector("iframe") as HTMLIFrameElement;
const widget = () => window.ECODrIx as NonNullable<Window["ECODrIx"]>;

/** A message as if posted by the chat frame (or by someone else). */
function fromFrame(
  data: unknown,
  { origin = FRAME_ORIGIN, source }: { origin?: string; source?: unknown } = {},
) {
  const e = new MessageEvent("message", { data, origin });
  Object.defineProperty(e, "source", {
    value: source === undefined ? iframe().contentWindow : source,
  });
  window.dispatchEvent(e);
}

afterEach(() => {
  window.ECODrIx?.destroy();
  sessionStorage.clear();
  delete window.ECODrIx;
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("one-line embed", () => {
  it("starts itself from data-erix", async () => {
    await load({ erix: "ACME" });
    expect(bubbles()).toHaveLength(1);
    expect(iframe().src).toBe(`${FRAME_ORIGIN}/widget-frame?c=ACME`);
    // A real button (keyboard and screen readers for free), named for what it does.
    expect(bubble().tagName).toBe("BUTTON");
    expect(bubble().getAttribute("aria-label")).toBe("Chat with us");
    expect(bubble().getAttribute("aria-expanded")).toBe("false");
  });

  it("without data-erix nothing starts; ECODrIx.init still works", async () => {
    await load({});
    expect(bubbles()).toHaveLength(0);
    widget().init({ clientCode: "ACME" });
    expect(bubbles()).toHaveLength(1);
  });

  it("never a second widget: tag + init, init twice, or the script twice", async () => {
    await load({ erix: "ACME" });
    widget().init({ clientCode: "OTHER" });
    widget().init({ clientCode: "ACME" });
    await load({ erix: "ACME" });
    expect(bubbles()).toHaveLength(1);
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });

  it("an async tag that runs before <body> waits for the page", async () => {
    Object.defineProperty(document, "body", { value: null, configurable: true });
    await load({ erix: "ACME" });
    delete (document as { body?: unknown }).body;
    expect(bubbles()).toHaveLength(0);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(bubbles()).toHaveLength(1);
  });

  it("destroy then init again (React remount) gives one working widget", async () => {
    const { ECODrIxWidget } = await load();
    const w = new ECODrIxWidget({ clientCode: "ACME" });
    w.init();
    w.destroy();
    w.init();
    expect(bubbles()).toHaveLength(1);
    w.showIframe();
    fromFrame({ type: "CHAT_WIDGET_CLOSE" });
    expect(w.isIframeVisible()).toBe(false);
    w.destroy();
  });
});

describe("CONFIG from the frame", () => {
  it("bubble hidden until CONFIG, then the business's colour and side", async () => {
    await load({ erix: "ACME" });
    expect(container().style.visibility).toBe("hidden");
    fromFrame({ type: "CONFIG", color: "#0f766e", position: "left" });
    expect(container().style.visibility).toBe("");
    expect(bubble().style.background).toMatch(/#0f766e|rgb\(15, 118, 110\)/i);
    expect(container().style.left).toBe("20px");
    expect(container().style.right).toBe("");
    expect(iframe().style.left).toBe("20px");
    expect(iframe().style.right).toBe("");
    // The window sits just above the 56 px button: 20 + 56 + 12.
    expect(iframe().style.bottom).toBe("88px");
  });

  it("no CONFIG in 3 s: shown with the defaults (ERIX blue, the console's default)", async () => {
    vi.useFakeTimers();
    await load({ erix: "ACME" });
    vi.advanceTimersByTime(2999);
    expect(container().style.visibility).toBe("hidden");
    vi.advanceTimersByTime(1);
    expect(container().style.visibility).toBe("");
    expect(bubble().style.background).toMatch(/#2b4dcb|rgb\(43, 77, 203\)/i);
    expect(container().style.right).toBe("20px");
  });

  it("ignored from another origin or another window; bad values are dropped", async () => {
    await load({ erix: "ACME" });
    fromFrame({ type: "CONFIG", color: "#000000" }, { origin: "https://evil.example" });
    // Right origin, wrong window (another console iframe on the page).
    fromFrame({ type: "CONFIG", color: "#000000" }, { source: window });
    expect(container().style.visibility).toBe("hidden");
    fromFrame({ type: "CONFIG", color: "red;background:url(//x)", position: "middle" });
    expect(container().style.visibility).toBe("");
    expect(bubble().style.background).toMatch(/#2b4dcb|rgb\(43, 77, 203\)/i);
    expect(container().style.right).toBe("20px");
  });
});

/** Spy on what the widget posts to the frame. */
async function loadAndSpy() {
  await load({ erix: "ACME" });
  const post = vi
    .spyOn(iframe().contentWindow as Window, "postMessage")
    .mockImplementation(() => {});
  const sent = (type: string) =>
    post.mock.calls.filter(([d]) => (d as { type: string }).type === type);
  return { post, sent };
}

describe("OPEN and PAGE to the frame", () => {
  it("PAGE on CONFIG, on open and on popstate/hashchange: path only, to the frame's origin", async () => {
    window.history.replaceState({}, "", "/pricing?utm_source=x#plans");
    document.title = "Pricing";
    const { post, sent } = await loadAndSpy();
    fromFrame({ type: "CONFIG" });
    expect(post).toHaveBeenLastCalledWith(
      { type: "PAGE", path: "/pricing", title: "Pricing" },
      FRAME_ORIGIN,
    );
    widget().show();
    expect(sent("PAGE")).toHaveLength(2);
    window.history.replaceState({}, "", "/contact");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(post).toHaveBeenLastCalledWith(
      { type: "PAGE", path: "/contact", title: "Pricing" },
      FRAME_ORIGIN,
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(sent("PAGE")).toHaveLength(4);
    for (const [, target] of post.mock.calls) expect(target).toBe(FRAME_ORIGIN);
  });

  it("OPEN only when the visitor opens the chat (the frame goes live then), to the frame's origin", async () => {
    const { sent } = await loadAndSpy();
    fromFrame({ type: "CONFIG" });
    expect(sent("OPEN")).toHaveLength(0);
    widget().show();
    expect(sent("OPEN")).toEqual([[{ type: "OPEN" }, FRAME_ORIGIN]]);
    widget().hide();
    widget().show();
    expect(sent("OPEN")).toHaveLength(2);
  });

  it("CLOSE when an open chat is hidden (replies stop counting as read), to the frame's origin", async () => {
    const { sent } = await loadAndSpy();
    widget().hide();
    expect(sent("CLOSE")).toHaveLength(0);
    widget().show();
    widget().hide();
    expect(sent("CLOSE")).toEqual([[{ type: "CLOSE" }, FRAME_ORIGIN]]);
    widget().hide();
    expect(sent("CLOSE")).toHaveLength(1);
  });

  it("opened before the frame was ready: OPEN again when its CONFIG arrives", async () => {
    const { sent } = await loadAndSpy();
    widget().show();
    expect(sent("OPEN")).toHaveLength(1);
    fromFrame({ type: "CONFIG" });
    expect(sent("OPEN")).toHaveLength(2);
  });
});

describe("phone sheet", () => {
  it("open marks the page so phones (≤ 480 px) get the full-screen, safe-area sheet with the page scroll locked; close and destroy restore it", async () => {
    await load({ erix: "ACME" });
    const css = document.getElementById("ecodrix-widget-styles")?.textContent ?? "";
    expect(css).toMatch(/@media \(max-width: 480px\)/);
    expect(css).toMatch(
      /html\[data-ecodrix-open\], html\[data-ecodrix-open\] body \{\s*overflow: hidden !important;/,
    );
    expect(css).toMatch(/top: env\(safe-area-inset-top, 0px\) !important;/);
    expect(css).toMatch(/left: env\(safe-area-inset-left, 0px\) !important;/);
    expect(iframe().hasAttribute("data-ecodrix-frame")).toBe(true);
    const marked = () => document.documentElement.hasAttribute("data-ecodrix-open");
    expect(marked()).toBe(false);
    widget().show();
    expect(marked()).toBe(true);
    fromFrame({ type: "CHAT_WIDGET_CLOSE" });
    expect(marked()).toBe(false);
    widget().show();
    widget().destroy();
    expect(marked()).toBe(false);
  });

  it("the sheet has explicit sizes (an auto-sized iframe is a 300×150 box): full width and height inside the safe area, dvh where supported", async () => {
    await load({ erix: "ACME" });
    const sheet = document.getElementById("ecodrix-widget-styles") as HTMLStyleElement;
    const media = [...(sheet.sheet?.cssRules ?? [])].find(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule && /max-width: 480px/.test(r.conditionText),
    );
    const rule = [...(media?.cssRules ?? [])].find(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && r.selectorText.includes("iframe[data-ecodrix-frame]"),
    );
    if (!rule) throw new Error("no phone-sheet rule");
    const width = rule.style.getPropertyValue("width");
    const height = rule.style.getPropertyValue("height");
    for (const v of [width, height]) expect(v).not.toMatch(/^auto$|^$/);
    expect(rule.style.getPropertyPriority("width")).toBe("important");
    expect(rule.style.getPropertyPriority("height")).toBe("important");
    // jsdom's CSSOM can't serialize env() inside calc(): the units are
    // checked there, the exact declarations in the stylesheet text.
    expect(width).toMatch(/^calc\(100vw/);
    // The last height wins where dvh is supported; 100vh is the fallback before it.
    expect(height).toMatch(/^calc\(100dvh/);
    const text = sheet.textContent ?? "";
    expect(text).toContain(
      "width: calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;",
    );
    expect(text).toMatch(
      /height: calc\(100vh - env\(safe-area-inset-top, 0px\) - env\(safe-area-inset-bottom, 0px\)\) !important;\s*height: calc\(100dvh - env\(safe-area-inset-top, 0px\) - env\(safe-area-inset-bottom, 0px\)\) !important;/,
    );
    expect(text).not.toMatch(/(width|height): auto/);
    expect(rule.style.getPropertyValue("right")).toBe("auto");
    expect(rule.style.getPropertyValue("bottom")).toBe("auto");
    expect(rule.style.getPropertyValue("border-radius")).toMatch(/^0(px)?$/);
  });
});

describe("desktop window size", () => {
  const size = () => [iframe().style.width, iframe().style.height];
  const viewport = (w: number, h: number) => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(w);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(h);
  };

  it("380 × 600 by default on a desktop screen", async () => {
    viewport(1440, 900);
    await load({ erix: "ACME" });
    expect(size()).toEqual(["380px", "600px"]);
  });

  it("kept inside a small laptop screen (above the bubble, 16 px from the top) and follows a resize", async () => {
    viewport(1366, 600);
    await load({ erix: "ACME" });
    // 600 − (20 edge + 56 button + 12 gap) − 16 top margin.
    expect(size()).toEqual(["380px", "496px"]);
    viewport(1366, 900);
    window.dispatchEvent(new Event("resize"));
    expect(size()).toEqual(["380px", "600px"]);
  });
});

describe("close + focus", () => {
  it("CHAT_WIDGET_CLOSE only from the frame it opened", async () => {
    await load({ erix: "ACME" });
    widget().show();
    fromFrame({ type: "CHAT_WIDGET_CLOSE" }, { origin: "https://evil.example" });
    fromFrame({ type: "CHAT_WIDGET_CLOSE" }, { source: window });
    expect(widget().isOpen()).toBe(true);
    fromFrame({ type: "CHAT_WIDGET_CLOSE" });
    expect(widget().isOpen()).toBe(false);
  });

  it("keyboard open moves focus into the chat; closing from inside returns it to the bubble", async () => {
    await load({ erix: "ACME" });
    fromFrame({ type: "CONFIG" });
    expect(iframe().getAttribute("tabindex")).toBe("-1");
    expect(iframe().getAttribute("aria-hidden")).toBe("true");
    bubble().focus();
    // A real <button>: Enter fires a click with no pointer (detail 0).
    expect(bubble().tagName).toBe("BUTTON");
    bubble().click();
    expect(bubble().getAttribute("aria-expanded")).toBe("true");
    expect(iframe().getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(iframe());
    fromFrame({ type: "CHAT_WIDGET_CLOSE" });
    expect(bubble().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(bubble());
    expect(iframe().getAttribute("tabindex")).toBe("-1");
  });
});

describe("the business's look (Look tab, 10 Nov 2026)", () => {
  it("shape, words, size, icon colour that reads, and distance from the edges", async () => {
    await load({ erix: "ACME" });
    fromFrame({
      type: "CONFIG",
      color: "#fde047",
      shape: "label",
      label: "Book a visit",
      size: "L",
      offsetBottom: 32,
      offsetSide: 12,
    });
    expect(bubble().dataset.shape).toBe("label");
    expect(bubble().textContent).toContain("Book a visit");
    expect(bubble().getAttribute("aria-label")).toBe("Book a visit");
    expect(bubble().style.height).toBe("64px");
    // Yellow is too light for white words: ink instead.
    expect(bubble().style.color).toMatch(/#161921|rgb\(22, 25, 33\)/i);
    expect(container().style.bottom).toBe("32px");
    expect(container().style.right).toBe("12px");
    // Open: the button becomes Close, without the words.
    bubble().click();
    expect(bubble().getAttribute("aria-label")).toBe("Close chat");
    expect(bubble().textContent).not.toContain("Book a visit");
  });

  it("an image icon only from https, never through innerHTML", async () => {
    await load({ erix: "ACME" });
    fromFrame({ type: "CONFIG", icon: "image", iconUrl: "javascript:alert(1)" });
    expect(bubble().querySelector("img")).toBeNull();
    fromFrame({ type: "CONFIG", icon: "image", iconUrl: "https://acme.in/tooth.svg" });
    expect(bubble().querySelector("img")?.getAttribute("src")).toBe("https://acme.in/tooth.svg");
    fromFrame({ type: "CONFIG", label: "<img src=x onerror=alert(1)>", shape: "label" });
    expect(bubble().querySelectorAll("img").length).toBe(1);
  });

  it("hidden pages, the chat turned off, and the site's own button", async () => {
    window.history.pushState({}, "", "/checkout/pay");
    await load({ erix: "ACME" });
    fromFrame({ type: "CONFIG", hiddenPaths: ["/checkout"] });
    expect(container().style.display).toBe("none");
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(container().style.display).toBe("");

    // Own button: no launcher, any data-erix-open element opens the chat.
    fromFrame({ type: "CONFIG", ownButton: true });
    expect(container().style.display).toBe("none");
    const own = document.createElement("a");
    own.href = "#";
    own.setAttribute("data-erix-open", "");
    own.innerHTML = "<span>Book a visit</span>";
    document.body.appendChild(own);
    (own.firstChild as HTMLElement).click();
    expect(widget().isOpen()).toBe(true);

    // Off (or this site isn't listed): closed, and nothing opens it.
    fromFrame({ type: "CONFIG", hidden: true, ownButton: false });
    expect(widget().isOpen()).toBe(false);
    expect(container().style.display).toBe("none");
    (own.firstChild as HTMLElement).click();
    expect(widget().isOpen()).toBe(false);
  });

  it("the welcome nudge: after its delay, once per visit, opens the chat", async () => {
    vi.useFakeTimers();
    await load({ erix: "ACME" });
    fromFrame({
      type: "CONFIG",
      nudge: { text: "Need an appointment? I can book it now.", delay: 5 },
    });
    vi.advanceTimersByTime(4999);
    expect(nudge()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(nudge()?.textContent).toContain("Need an appointment?");
    nudge()?.querySelector<HTMLElement>("[data-text]")?.click();
    expect(widget().isOpen()).toBe(true);
    expect(nudge()).toBeNull();
    // Same visit, next page: not again.
    widget().destroy();
    await load({ erix: "ACME" });
    fromFrame({ type: "CONFIG", nudge: { text: "Again?", delay: 1 } });
    vi.advanceTimersByTime(2000);
    expect(nudge()).toBeNull();
  });
});

describe("unread badge (CHAT_WIDGET_UNREAD, 2.3)", () => {
  it("draws the count (9+ above nine), names it on the button, clears on open", async () => {
    await load({ erix: "ACME" });
    const badge = () => bubble().querySelector<HTMLElement>("[data-ecodrix-badge]");
    expect(badge()).toBeNull();
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 3 });
    expect(badge()?.textContent).toBe("3");
    expect(badge()?.getAttribute("aria-hidden")).toBe("true");
    expect(bubble().getAttribute("aria-label")).toBe("Open chat, 3 unread messages");
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 1 });
    expect(bubble().getAttribute("aria-label")).toBe("Open chat, 1 unread message");
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 12 });
    expect(badge()?.textContent).toBe("9+");
    widget().show();
    expect(badge()).toBeNull();
    expect(bubble().getAttribute("aria-label")).toBe("Close chat");
  });

  it("0 hides it; bad counts and other origins or windows are ignored", async () => {
    await load({ erix: "ACME" });
    const badge = () => bubble().querySelector("[data-ecodrix-badge]");
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 2 });
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 0 });
    expect(badge()).toBeNull();
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 5 }, { origin: "https://evil.example" });
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 5 }, { source: window });
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: "5" });
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: -1 });
    expect(badge()).toBeNull();
  });
});

// ── 2.4: facade, greetings, holdout, avoidSelectors ────────────────────────

const LAUNCHER = {
  color: "#0f766e",
  position: "right",
  greetings: [
    { path: "/", text: "Welcome" },
    { path: "/pricing", text: "Questions about price?" },
  ],
  greetingMeasure: true,
  avoidSelectors: ["#cookie"],
};
const okFetch = (data: unknown = LAUNCHER) =>
  vi.fn(async (..._a: unknown[]) => ({ ok: true, status: 200, json: async () => ({ data }) }));
const flush = () => vi.advanceTimersByTimeAsync(0);
const greeting = () => document.querySelector<HTMLElement>("[data-greeting]");

/** A visitor id that the holdout hash does (or does not) pick. */
function vidWhere(holdout: boolean, hash: (s: string) => number): string {
  for (let i = 0; ; i++) if ((hash(`v${i}`) % 10 === 0) === holdout) return `v${i}`;
}
async function pinVid(holdout: boolean) {
  const { hash32 } = await import("../src/index");
  localStorage.setItem("erix-vid:ACME", vidWhere(holdout, hash32));
}

async function startFake(data: unknown = LAUNCHER, path = "/") {
  vi.useFakeTimers();
  window.history.replaceState({}, "", path);
  const fetchMock = okFetch(data);
  await load({ erix: "ACME" }, fetchMock);
  await flush();
  return { fetchMock };
}
const restart = () => {
  window.ECODrIx?.destroy();
  delete window.ECODrIx;
  sessionStorage.clear();
};

describe("launcher facade", () => {
  it("shows the button from the launcher read and builds no iframe until the first click", async () => {
    const { fetchMock } = await startFake();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.ecodrix.com/v1/api/infra/connect/webhooks/webchat/ACME/launcher",
    );
    expect(container().style.visibility).toBe("");
    expect(bubble().style.background).toMatch(/#0f766e|rgb\(15, 118, 110\)/i);
    expect(document.querySelector("iframe")).toBeNull();
    bubble().click();
    expect(iframe().src).toBe(`${FRAME_ORIGIN}/widget-frame?c=ACME`);
    expect(widget().isOpen()).toBe(true);
  });

  it("opening before the frame loads: OPEN is sent again when its CONFIG arrives", async () => {
    await startFake();
    bubble().click();
    const post = vi
      .spyOn(iframe().contentWindow as Window, "postMessage")
      .mockImplementation(() => {});
    fromFrame({ type: "CONFIG", color: "#0f766e" });
    expect(post.mock.calls.some(([d]) => (d as { type: string }).type === "OPEN")).toBe(true);
  });

  it("caches the read for 5 minutes in sessionStorage", async () => {
    const { fetchMock } = await startFake();
    window.ECODrIx?.destroy();
    delete window.ECODrIx;
    await load({ erix: "ACME" }, fetchMock);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container().style.visibility).toBe("");
  });

  it("403 (this site is not listed) hides the button; other failures fall back to the preloaded frame", async () => {
    vi.useFakeTimers();
    await load(
      { erix: "ACME" },
      vi.fn(async () => ({ ok: false, status: 403 })),
    );
    await flush();
    expect(container().style.display).toBe("none");
    expect(document.querySelector("iframe")).toBeNull();
    restart();
    await load(
      { erix: "ACME" },
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
    await flush();
    expect(document.querySelector("iframe")).not.toBeNull();
  });

  it("a returning chatter (erix-active flag) gets the frame on idle, others never", async () => {
    vi.useFakeTimers();
    localStorage.setItem("erix-active:ACME", "1");
    await load({ erix: "ACME" }, okFetch());
    await flush();
    expect(document.querySelector("iframe")).toBeNull();
    vi.advanceTimersByTime(4000);
    expect(document.querySelector("iframe")).not.toBeNull();
    restart();
    localStorage.clear();
    await load({ erix: "ACME" }, okFetch());
    await flush();
    vi.advanceTimersByTime(30000);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("CHAT_WIDGET_ACTIVE sets the flag, only from the frame's origin and window", async () => {
    await load({ erix: "ACME" });
    fromFrame({ type: "CHAT_WIDGET_ACTIVE" }, { origin: "https://evil.example" });
    fromFrame({ type: "CHAT_WIDGET_ACTIVE" }, { source: window });
    expect(localStorage.getItem("erix-active:ACME")).toBeNull();
    fromFrame({ type: "CHAT_WIDGET_ACTIVE" });
    expect(localStorage.getItem("erix-active:ACME")).toBe("1");
  });

  it("the unread badge still works with a frame that was built later", async () => {
    await startFake();
    bubble().click();
    fromFrame({ type: "CHAT_WIDGET_CLOSE" });
    fromFrame({ type: "CHAT_WIDGET_UNREAD", count: 2 });
    expect(bubble().getAttribute("aria-label")).toBe("Open chat, 2 unread messages");
  });
});

describe("greetings by page", () => {
  it("none before 8 s, then once: longest matching path, a labelled close, role=status", async () => {
    await pinVid(false);
    await startFake(LAUNCHER, "/pricing/plans");
    vi.advanceTimersByTime(7999);
    expect(greeting()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(greeting()?.textContent).toContain("Questions about price?");
    expect(greeting()?.getAttribute("role")).toBe("status");
    const close = greeting()?.querySelector("[data-dismiss]");
    expect(close?.getAttribute("aria-label")).toBe("Close greeting");
    (close as HTMLElement).click();
    expect(greeting()).toBeNull();
    expect(localStorage.getItem("erix-greet:ACME:/pricing")).toBe("shown");
  });

  it("not again for the same visitor and path; another path rule still shows", async () => {
    await pinVid(false);
    localStorage.setItem("erix-greet:ACME:/pricing", "shown");
    await startFake(LAUNCHER, "/pricing");
    vi.advanceTimersByTime(9000);
    expect(greeting()).toBeNull();
    restart();
    await startFake(LAUNCHER, "/about");
    vi.advanceTimersByTime(8000);
    expect(greeting()?.textContent).toContain("Welcome");
  });

  it("holdout (hash % 10 === 0): no bubble, still counted, bucket sent to the frame", async () => {
    await pinVid(true);
    const beacon = vi.fn((..._a: unknown[]) => true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    await startFake(LAUNCHER, "/pricing");
    vi.advanceTimersByTime(8000);
    expect(greeting()).toBeNull();
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe(
      "https://api.ecodrix.com/v1/api/infra/connect/webhooks/webchat/ACME/greeting-stat",
    );
    expect(blob.type).toBe("application/json");
    bubble().click();
    const post = vi
      .spyOn(iframe().contentWindow as Window, "postMessage")
      .mockImplementation(() => {});
    fromFrame({ type: "CONFIG" });
    expect(post).toHaveBeenCalledWith({ type: "INIT", greeting: "holdout" }, FRAME_ORIGIN);
    // Decided once: the next page view neither counts nor greets again.
    expect(localStorage.getItem("erix-greet:ACME:/pricing")).toBe("holdout");
    delete (navigator as { sendBeacon?: unknown }).sendBeacon;
  });

  it("shown bucket: one count, by keepalive fetch when sendBeacon is missing", async () => {
    await pinVid(false);
    const { fetchMock } = await startFake(LAUNCHER, "/pricing");
    vi.advanceTimersByTime(8000);
    const counts = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/greeting-stat"));
    expect(counts).toHaveLength(1);
    const init = counts[0][1] as RequestInit;
    expect(init).toMatchObject({ method: "POST", keepalive: true });
    expect(JSON.parse(String(init.body))).toMatchObject({ bucket: "shown", path: "/pricing" });
  });

  it("measure off: no holdout, no count, everyone sees the greeting", async () => {
    await pinVid(true);
    const { fetchMock } = await startFake({ ...LAUNCHER, greetingMeasure: false }, "/pricing");
    vi.advanceTimersByTime(8000);
    expect(greeting()).not.toBeNull();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).endsWith("/greeting-stat"))).toBe(false);
  });

  it("waits while an avoided element is on screen", async () => {
    await pinVid(false);
    const bar = document.createElement("div");
    bar.id = "cookie";
    bar.style.position = "fixed";
    bar.getBoundingClientRect = () =>
      ({ top: 700, bottom: 768, height: 68, width: 300 }) as DOMRect;
    document.body.appendChild(bar);
    await startFake(LAUNCHER, "/pricing");
    vi.advanceTimersByTime(9000);
    expect(greeting()).toBeNull();
    bar.remove();
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(300);
    expect(greeting()).not.toBeNull();
  });
});

describe("avoidSelectors", () => {
  const bar = (top: number) => {
    const el = document.createElement("div");
    el.id = "cookie";
    el.style.position = "fixed";
    el.getBoundingClientRect = () =>
      ({ top, bottom: 768, height: 768 - top, width: 300 }) as DOMRect;
    document.body.appendChild(el);
    return el;
  };

  it("lifts the button above a visible fixed bottom element and drops back when it goes", async () => {
    const el = bar(700);
    await startFake();
    // 768 (jsdom viewport) - 700 = 68 px above the 20 px offset.
    expect(container().style.bottom).toBe("88px");
    el.remove();
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(300);
    expect(container().style.bottom).toBe("20px");
  });

  it("rechecks through the MutationObserver when the page adds the element", async () => {
    await startFake();
    expect(container().style.bottom).toBe("20px");
    bar(700);
    await flush();
    vi.advanceTimersByTime(300);
    expect(container().style.bottom).toBe("88px");
  });

  it("ignores hidden, non-fixed and top-of-page matches, and bad selectors", async () => {
    const { liftFor } = await import("../src/index");
    const el = bar(700);
    el.style.position = "static";
    expect(liftFor(["#cookie", "<bad", "###"])).toBe(0);
    el.style.position = "fixed";
    el.style.display = "none";
    expect(liftFor(["#cookie"])).toBe(0);
    el.style.display = "";
    el.getBoundingClientRect = () => ({ top: 0, bottom: 60, height: 60, width: 300 }) as DOMRect;
    expect(liftFor(["#cookie"])).toBe(0);
  });

  it("selectors: at most 5, 100 chars, no < or {", async () => {
    const { cleanSelectors } = await import("../src/index");
    const out = cleanSelectors(["#a", ".b", "x{y}", "<z", "p".repeat(101), "#c", "#d", "#e", "#f"]);
    expect(out).toEqual(["#a", ".b", "#c", "#d", "#e"]);
    expect(cleanSelectors("nope")).toEqual([]);
  });
});
