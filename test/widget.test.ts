/**
 * The loader: the one-line embed (`data-erix`), the CONFIG handshake with the
 * chat frame (bubble hidden until then, 3 s fallback), PAGE context, the
 * origin + window checks on every message, and focus in/out.
 *
 * Vitest globals (see vitest.config.mjs); outside tsconfig's `src` on purpose,
 * since this package has no vitest types installed.
 */

const FRAME_ORIGIN = "https://console.ecodrix.com";

/** A fresh copy of the module, run as if from `<script data-erix=…>`. */
async function load(script?: { erix?: string }) {
  vi.resetModules();
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

const bubbles = () =>
  document.querySelectorAll<HTMLElement>("[data-ecodrix-bubble]");
const bubble = () => bubbles()[0];
const container = () => bubble().parentElement as HTMLElement;
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
  delete window.ECODrIx;
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("one-line embed", () => {
  it("starts itself from data-erix", async () => {
    await load({ erix: "ACME" });
    expect(bubbles()).toHaveLength(1);
    expect(iframe().src).toBe(`${FRAME_ORIGIN}/widget-frame?c=ACME`);
    expect(bubble().getAttribute("role")).toBe("button");
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
    expect(container().style.left).toBe("16px");
    expect(container().style.right).toBe("");
    expect(iframe().style.left).toBe("16px");
    expect(iframe().style.right).toBe("");
  });

  it("no CONFIG in 3 s: shown with the defaults (ERIX blue, the console's default)", async () => {
    vi.useFakeTimers();
    await load({ erix: "ACME" });
    vi.advanceTimersByTime(2999);
    expect(container().style.visibility).toBe("hidden");
    vi.advanceTimersByTime(1);
    expect(container().style.visibility).toBe("");
    expect(bubble().style.background).toMatch(/#2b4dcb|rgb\(43, 77, 203\)/i);
    expect(container().style.right).toBe("16px");
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
    expect(container().style.right).toBe("16px");
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
    expect(css).toMatch(/html\[data-ecodrix-open\], html\[data-ecodrix-open\] body \{\s*overflow: hidden !important;/);
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
      (r): r is CSSMediaRule => r instanceof CSSMediaRule && /max-width: 480px/.test(r.conditionText),
    );
    const rule = [...(media?.cssRules ?? [])].find(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.includes("iframe[data-ecodrix-frame]"),
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
    // 600 − 56 bubble − 24 gap − 16 top margin.
    expect(size()).toEqual(["380px", "504px"]);
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
    bubble().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(bubble().getAttribute("aria-expanded")).toBe("true");
    expect(iframe().getAttribute("aria-hidden")).toBe("false");
    expect(document.activeElement).toBe(iframe());
    fromFrame({ type: "CHAT_WIDGET_CLOSE" });
    expect(bubble().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(bubble());
    expect(iframe().getAttribute("tabindex")).toBe("-1");
  });
});
