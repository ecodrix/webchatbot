/**
 * @module @ecodrix/chatbot
 * ECODrIx chat widget — a lightweight, dependency-free chat button that opens
 * the hosted chat iframe. Usable via the one-line CDN tag
 * (`<script src="…/index.global.js" data-erix="CLIENT_CODE" async></script>`,
 * starts itself), `window.ECODrIx.init`, any bundler (ESM/CJS), or the React
 * entry (`@ecodrix/chatbot/react`).
 *
 * The button's look comes from the business's saved settings (ERIX › Channels
 * › Website chat › Look), sent by the frame as CONFIG, so the one line on the
 * site never changes. Any element with `data-erix-open` opens the chat.
 *
 * postMessage protocol with the hosted frame (`/widget-frame`). Messages in
 * are trusted only from the iframe this widget opened (its origin AND its
 * window); messages out go to that origin only.
 *   frame → widget  CHAT_WIDGET_CLOSE              close (Esc / close button)
 *   frame → widget  CONFIG { color?, position?,    the business's look: colour
 *                    shape?, label?, icon?,         (#rrggbb), side, button
 *                    iconUrl?, size?, offsetBottom?, shape / words / icon /
 *                    offsetSide?, hiddenPaths?,     size, distance from the
 *                    ownButton?, nudge?, hidden? }  edges, pages to stay off,
 *                                                  "own button", the welcome
 *                                                  nudge, and `hidden` (chat
 *                                                  off, or this site isn't listed)
 *   widget → frame  OPEN                           the visitor opened the chat
 *                                                  (again on CONFIG if already
 *                                                  open): the frame goes live
 *   widget → frame  CLOSE                          the chat was hidden: replies
 *                                                  no longer count as read
 *   widget → frame  PAGE { path, title }           on open, on CONFIG and on
 *                                                  popstate/hashchange; path
 *                                                  only (no query or hash)
 *
 * On phones (viewport ≤ 480 px) the open chat is a full-screen sheet inside
 * the safe area, and the host page doesn't scroll behind it.
 */

/** Button screen position. */
export type BubblePosition = "bottom-left" | "bottom-right" | "top-left" | "top-right";
/** Round, rounded square, or a pill with words. */
export type LauncherShape = "round" | "square" | "label";
/** Built-in icons; `image` shows `iconUrl` (a logo or the business's own icon). */
export type LauncherIcon = "chat" | "help" | "calendar" | "phone" | "image";
export type LauncherSize = "S" | "M" | "L";

/** Configuration for the ECODrIx chat widget. */
export interface ECODrIxWidgetConfig {
  // ── Identity (recommended) ──────────────────────────────────────────────
  /**
   * Your PUBLIC workspace client code. When set, the SDK builds the hosted
   * widget URL for you (`${baseUrl}/widget-frame?c=<clientCode>`). Not a secret.
   * One of `clientCode` or `botUrl` is required.
   */
  clientCode?: string;
  /** Base origin of the ECODrIx app. Default `https://console.ecodrix.com`. */
  baseUrl?: string;
  /** Advanced: explicit iframe URL. Optional when `clientCode` is set. */
  botUrl?: string;

  // ── Events ──────────────────────────────────────────────────────────────
  /** Called when the chat window opens. */
  onOpen?: () => void;
  /** Called when the chat window closes. */
  onClose?: () => void;

  // ── Appearance (the saved Look settings override these) ───────────────────
  /** Your own icon: emoji, SVG string or image URL (shown when no saved icon). */
  bubbleIcon?: string;
  /** Button colour (#rrggbb). */
  bubbleColor?: string;
  /** Icon colour; default: white or ink, whichever reads on the colour. */
  iconColor?: string;
  /** @deprecated No pulse any more; kept so old configs still type-check. */
  pulseColor?: string;
  /** Accessible name of the button ("Chat with us"). */
  tooltipText?: string;
  /** @deprecated The hover tooltip was replaced by the welcome nudge. */
  tooltipColor?: string;
  /** @deprecated The hover tooltip was replaced by the welcome nudge. */
  tooltipBgColor?: string;
  /** Button height in px (overrides `size`). */
  bubbleSize?: number;
  /** Screen corner. */
  bubblePosition?: BubblePosition;
  shape?: LauncherShape;
  /** Words on the "label" shape, any language. */
  label?: string;
  icon?: LauncherIcon;
  /** `https://` image for `icon: "image"`. */
  iconUrl?: string;
  size?: LauncherSize;
  /** Pixels from the bottom (or top) and from the side. Default 20. */
  offsetBottom?: number;
  offsetSide?: number;
  /** Page paths where the chat stays away (`/checkout` also hides `/checkout/…`). */
  hiddenPaths?: string[];
  /** Hide the button: the site opens the chat from its own `data-erix-open` element. */
  ownButton?: boolean;
  /** A small message above the button after `delay` seconds, once per visit. */
  nudge?: { text: string; delay: number } | null;
  /** Chat window width in px (default 380, kept inside the viewport). */
  iframeWidth?: number;
  /** Chat window height in px (default 600, kept inside the viewport). */
  iframeHeight?: number;
  /** Chat window corner radius in px. */
  iframeBorderRadius?: number;
  /** Chat window shadow. */
  shadow?: string;
  /** Button shadow. */
  bubbleShadow?: string;
  /** Close the chat on a click outside it. */
  closeClickOutside?: boolean;
  /** Auto-open after N seconds (0 = disabled). */
  autoOpen?: number;
}

/** Icons drawn on the button (24 px grid, stroke = currentColor; Lucide, ISC). */
const ICONS: Record<Exclude<LauncherIcon, "image"> | "close", string> = {
  chat: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  calendar:
    '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  phone:
    '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};
const svg = (paths: string, px: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

const SIZES: Record<LauncherSize, number> = { S: 48, M: 56, L: 64 };
const INK = "#161921";

const DEFAULTS = {
  bubbleIcon: "",
  // ERIX blue (`--primary`): the console's default colour and the frame's
  // default visitor bubble, so a business with no colour saved sees one blue.
  bubbleColor: "#2b4dcb",
  iconColor: "",
  tooltipText: "Chat with us",
  closeClickOutside: true,
  bubbleSize: 0,
  bubblePosition: "bottom-right" as BubblePosition,
  shape: "round" as LauncherShape,
  label: "",
  icon: "chat" as LauncherIcon,
  iconUrl: "",
  size: "M" as LauncherSize,
  offsetBottom: 20,
  offsetSide: 20,
  hiddenPaths: [] as string[],
  ownButton: false,
  nudge: null as { text: string; delay: number } | null,
  iframeWidth: 380,
  iframeHeight: 600,
  iframeBorderRadius: 16,
  autoOpen: 0,
  shadow: "0 24px 48px -12px rgba(14,32,107,0.32), 0 0 0 1px rgba(14,32,107,0.06)",
  bubbleShadow: "0 1px 2px rgba(14,32,107,0.22), 0 8px 24px -6px rgba(14,32,107,0.35)",
  baseUrl: "https://console.ecodrix.com",
};

type ResolvedConfig = typeof DEFAULTS &
  Omit<ECODrIxWidgetConfig, keyof typeof DEFAULTS> & { botUrl?: string };

/** Origin of the widget iframe URL, or "" when there's no valid URL. */
function frameOrigin(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

/** How long the button waits for the frame's CONFIG before showing the defaults. */
const CONFIG_TIMEOUT_MS = 3000;
const HEX = /^#[0-9a-f]{6}$/i;
const NUDGE_KEY = "ecodrix-nudge-seen";

/** White, unless white falls under `min` contrast on the colour (WCAG): then ink. */
export function readableOn(hex: string, min = 3): string {
  const ch = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
  return 1.05 / (l + 0.05) >= min ? "#ffffff" : INK;
}

/** Is `path` one of `hidden` (or below one)? `/checkout` hides `/checkout/pay`. */
export function onHiddenPath(path: string, hidden: readonly string[]): boolean {
  return hidden.some((p) => {
    const base = p.replace(/\/+$/, "") || "/";
    return base === "/" ? path === "/" : path === base || path.startsWith(`${base}/`);
  });
}

const httpsUrl = (v: unknown): string =>
  typeof v === "string" && /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : "";
const px = (v: unknown, max = 160): number | undefined =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : undefined;

/**
 * Resolve the iframe URL from config: an explicit `botUrl` wins; otherwise it's
 * derived from `clientCode` + `baseUrl`. Returns `undefined` when neither is
 * usable. Pure — the single source of truth for URL building.
 */
export function resolveWidgetUrl(config: {
  botUrl?: string;
  clientCode?: string;
  baseUrl?: string;
}): string | undefined {
  if (config.botUrl) return config.botUrl;
  if (!config.clientCode) return undefined;
  const base = String(config.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, "");
  return `${base}/widget-frame?c=${encodeURIComponent(config.clientCode)}`;
}

let activeWidget: ECODrIxWidget | null = null;

export class ECODrIxWidget {
  // Definite-assignment: set in the constructor's normal path. The singleton
  // early-return discards the un-initialized throwaway instance.
  private config!: ResolvedConfig;
  private container!: HTMLDivElement;
  private bubble!: HTMLButtonElement;
  private nudgeBox: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private autoOpenTimeout: ReturnType<typeof setTimeout> | null = null;
  private configTimeout: ReturnType<typeof setTimeout> | null = null;
  private nudgeTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Set while running: removes every window listener on destroy. */
  private listeners: AbortController | null = null;
  private isOpen = false;
  /** The frame said: chat off, or this website isn't on the business's list. */
  private hidden = false;

  constructor(config: ECODrIxWidgetConfig) {
    if (activeWidget) return activeWidget;

    this.config = { ...DEFAULTS, ...config } as ResolvedConfig;
    this.config.botUrl = resolveWidgetUrl(this.config);
  }

  init(): void {
    // Already running (a second init, or the one-line tag plus init): one
    // button, one iframe.
    if (this.listeners) return;
    if (!this.config.botUrl) {
      throw new Error("[ECODrIx] Provide `clientCode` (recommended) or `botUrl`.");
    }
    this.listeners = new AbortController();
    const on = { signal: this.listeners.signal };
    window.addEventListener("message", (e) => this.onFrameMessage(e), on);
    window.addEventListener("resize", () => this.updateDimensions(), on);
    window.addEventListener("orientationchange", () => this.updateDimensions(), on);
    // A single-page site moved on: the chat gets the new page, and pages the
    // business hid take the chat away.
    // ponytail: history.pushState fires no event, so an SPA's in-app link
    // while the chat is open isn't seen (PAGE is re-sent on every open) —
    // wrap pushState/replaceState if stale page context shows up.
    const moved = () => {
      this.postPage();
      this.applyVisibility();
    };
    window.addEventListener("popstate", moved, on);
    window.addEventListener("hashchange", moved, on);
    // The site's own buttons: any element with `data-erix-open` opens the chat.
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target as Element | null;
        if (!target?.closest?.("[data-erix-open]") || this.hidden) return;
        e.preventDefault();
        this.showIframe();
        this.iframe?.focus();
      },
      on,
    );
    // Close on a click outside the chat (desktop), as before.
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!this.isOpen || !this.config.closeClickOutside) return;
        const t = e.target as Node | null;
        if (t && (this.container.contains(t) || this.iframe?.contains(t))) return;
        if ((t as Element | null)?.closest?.("[data-erix-open]")) return;
        if (window.innerWidth > 480) this.hideIframe();
      },
      on,
    );

    this.addStyles();
    this.createBubble();
    this.preloadIframe();
    this.paint();
    this.place();
    // After the iframe exists — before, the phone sizing silently no-op'd.
    this.updateDimensions();
    // The button stays hidden until the frame sends the business's look
    // (CONFIG), so it never flashes the wrong one; defaults after 3 s.
    this.configTimeout = setTimeout(() => this.reveal(), CONFIG_TIMEOUT_MS);

    if (this.config.autoOpen > 0) {
      this.autoOpenTimeout = setTimeout(() => this.showIframe(), this.config.autoOpen * 1000);
    }
  }

  /** The button's height in px. */
  private size(): number {
    return this.config.bubbleSize > 0 ? this.config.bubbleSize : SIZES[this.config.size];
  }

  /** How far above the edge the chat window sits: just above the button. */
  private windowGap(): number {
    return this.config.ownButton
      ? this.config.offsetBottom
      : this.config.offsetBottom + this.size() + 12;
  }

  updateDimensions(_width?: number, _height?: number): void {
    if (!this.iframe) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let iframeWidth = this.config.iframeWidth;
    let iframeHeight = this.config.iframeHeight;
    if (vw <= 768) {
      iframeWidth = Math.min(360, iframeWidth * 0.9);
      iframeHeight = Math.min(540, iframeHeight * 1);
    }
    // Small laptop screens: the window sits above the button and keeps 16 px
    // from the other edges.
    iframeWidth = Math.min(iframeWidth, vw - 32);
    iframeHeight = Math.min(iframeHeight, vh - this.windowGap() - 16);
    // Phones: this is the closed size; the open chat is the full-screen
    // sheet in addStyles().
    if (vw <= 480) {
      iframeWidth = vw - 80;
      iframeHeight = vh * 0.7;
    }
    this.iframe.style.width = `${iframeWidth}px`;
    this.iframe.style.height = `${iframeHeight}px`;
  }

  private addStyles(): void {
    if (document.getElementById("ecodrix-widget-styles")) return;
    const styles = `
      [data-ecodrix-bubble] {
        all: initial; box-sizing: border-box; cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        font: 700 14px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        transition: transform .18s ease, box-shadow .18s ease;
        -webkit-tap-highlight-color: transparent;
      }
      [data-ecodrix-bubble]:hover { transform: translateY(-1px); }
      [data-ecodrix-bubble]:active { transform: scale(.97); }
      [data-ecodrix-bubble]:focus-visible { outline: 3px solid rgba(43,77,203,.55); outline-offset: 3px; }
      [data-ecodrix-bubble] img { width: 58%; height: 58%; object-fit: contain; border-radius: 6px; pointer-events: none; }
      [data-ecodrix-bubble][data-shape="label"] img { width: 22px; height: 22px; }
      [data-ecodrix-nudge] {
        position: absolute; display: flex; align-items: flex-start; gap: 6px;
        width: max-content; max-width: 240px; padding: 10px 8px 10px 12px;
        background: #fff; color: #161921; border-radius: 14px;
        box-shadow: 0 0 0 1px rgba(14,32,107,.08), 0 12px 32px -8px rgba(14,32,107,.3);
        font: 500 13px/18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        animation: ecodrix-nudge-in .22s ease-out;
      }
      [data-ecodrix-nudge] button { all: unset; cursor: pointer; }
      [data-ecodrix-nudge] [data-text]:focus-visible, [data-ecodrix-nudge] [data-dismiss]:focus-visible { outline: 2px solid #2b4dcb; outline-offset: 2px; border-radius: 4px; }
      [data-ecodrix-nudge] [data-dismiss] { color: #575c67; padding: 0 4px; font-size: 16px; line-height: 16px; }
      @keyframes ecodrix-nudge-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) {
        [data-ecodrix-bubble], iframe[data-ecodrix-frame] { transition: none !important; }
        [data-ecodrix-nudge] { animation: none; }
      }
      /* Phones: the open chat fills the screen inside the safe area (notch,
         home bar), above the button, and the page behind it doesn't scroll.
         Closing removes the attribute, which restores both. Explicit sizes:
         an iframe sized "auto" between insets falls back to 300x150. 100vh
         first, then 100dvh where supported (the visible height, without the
         browser's toolbars). */
      @media (max-width: 480px) {
        html[data-ecodrix-open], html[data-ecodrix-open] body {
          overflow: hidden !important;
        }
        html[data-ecodrix-open] iframe[data-ecodrix-frame] {
          top: env(safe-area-inset-top, 0px) !important;
          left: env(safe-area-inset-left, 0px) !important;
          right: auto !important;
          bottom: auto !important;
          width: calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)) !important;
          height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
          height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) !important;
          border-radius: 0 !important;
          z-index: 2147483647 !important;
        }
      }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.id = "ecodrix-widget-styles";
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  private createBubble(): void {
    this.container = document.createElement("div");
    this.container.setAttribute("data-ecodrix-launcher", "");
    this.container.style.cssText =
      "position: fixed; z-index: 100000; pointer-events: auto; visibility: hidden;";

    // A real button: keyboards and screen readers get it for free.
    this.bubble = document.createElement("button");
    this.bubble.type = "button";
    this.bubble.setAttribute("data-ecodrix-bubble", "");
    this.bubble.setAttribute("aria-label", this.config.tooltipText);
    this.bubble.setAttribute("aria-expanded", "false");
    this.bubble.addEventListener("click", (e) => {
      this.toggleIframe();
      // Keyboard users (Enter / Space: a click with no pointer) land in the
      // chat box (the frame focuses its input).
      if (this.isOpen && e.detail === 0) this.iframe?.focus();
    });
    this.container.appendChild(this.bubble);
    document.body.appendChild(this.container);
  }

  /** Shape, colour, icon and words of the button, from the current config. */
  private paint(): void {
    const c = this.config;
    const size = this.size();
    const words = c.shape === "label" && !!c.label && !this.isOpen;
    const b = this.bubble.style;
    this.bubble.setAttribute(
      "data-shape",
      words ? "label" : c.shape === "square" ? "square" : "round",
    );
    b.height = `${size}px`;
    b.minWidth = `${size}px`;
    b.width = words ? "auto" : `${size}px`;
    b.padding = words ? `0 20px 0 ${Math.round(size / 3.2)}px` : "0";
    b.borderRadius = c.shape === "square" && !words ? `${Math.round(size * 0.28)}px` : "9999px";
    b.background = c.bubbleColor;
    // Words need 4.5:1 (text); an icon alone 3:1 (a graphic).
    b.color = c.iconColor || readableOn(c.bubbleColor, words ? 4.5 : 3);
    b.boxShadow = c.bubbleShadow;

    const iconPx = Math.round(size * (words ? 0.4 : 0.44));
    // Built from parts: the frame's words and URLs never go through innerHTML.
    this.bubble.textContent = "";
    if (this.isOpen) this.bubble.insertAdjacentHTML("beforeend", svg(ICONS.close, iconPx));
    else if (c.icon === "image" && c.iconUrl) {
      const img = document.createElement("img");
      img.src = c.iconUrl;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      this.bubble.appendChild(img);
    } else if (c.bubbleIcon && c.icon === "chat") {
      // The integrator's own icon from `init` (their page, their markup).
      const box = document.createElement("span");
      box.style.cssText = "display:flex;align-items:center;justify-content:center";
      box.innerHTML = /^https?:\/\//.test(c.bubbleIcon)
        ? `<img src="${c.bubbleIcon.replace(/"/g, "&quot;")}" alt="">`
        : c.bubbleIcon;
      this.bubble.appendChild(box);
    } else
      this.bubble.insertAdjacentHTML(
        "beforeend",
        svg(ICONS[(c.icon === "image" ? "chat" : c.icon) as keyof typeof ICONS], iconPx),
      );
    if (words) {
      const span = document.createElement("span");
      span.textContent = c.label;
      this.bubble.appendChild(span);
    }
    this.bubble.setAttribute(
      "aria-label",
      this.isOpen ? "Close chat" : words ? c.label : c.tooltipText,
    );
  }

  private preloadIframe(): void {
    this.iframe = document.createElement("iframe");
    this.iframe.setAttribute("data-ecodrix-frame", "");
    this.iframe.src = this.config.botUrl as string;
    this.iframe.allow = "microphone";
    this.iframe.title = this.config.tooltipText || "Chat";
    // Closed by default — keep it out of the tab order + hidden from AT.
    this.iframe.setAttribute("aria-hidden", "true");
    this.iframe.setAttribute("tabindex", "-1");
    this.iframe.style.cssText = `
      position: fixed;
      width: ${this.config.iframeWidth}px;
      height: ${this.config.iframeHeight}px;
      border: none;
      border-radius: ${this.config.iframeBorderRadius}px;
      box-shadow: ${this.config.shadow};
      z-index: 99999;
      opacity: 0;
      transform: scale(0.96) translateY(12px);
      pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
      background: white;
    `;
    document.body.appendChild(this.iframe);
  }

  toggleIframe(): void {
    if (this.isOpen) this.hideIframe();
    else this.showIframe();
  }

  showIframe(): void {
    if (!this.iframe || this.hidden) return;
    this.reveal();
    this.dropNudge(true);
    // The frame opens its live connection only now (it's preloaded, hidden,
    // on every page view).
    this.post({ type: "OPEN" });
    this.postPage();
    document.documentElement.setAttribute("data-ecodrix-open", "");
    this.isOpen = true;
    this.iframe.style.opacity = "1";
    this.iframe.style.transform = "none";
    this.iframe.style.pointerEvents = "auto";
    this.iframe.setAttribute("aria-hidden", "false");
    this.iframe.removeAttribute("tabindex");
    this.bubble?.setAttribute("aria-expanded", "true");
    this.paint();
    this.config.onOpen?.();
  }

  hideIframe(): void {
    if (!this.iframe) return;
    // Closing from inside the chat (Esc / close button) must not drop focus.
    if (document.activeElement === this.iframe && !this.config.ownButton) this.bubble?.focus();
    document.documentElement.removeAttribute("data-ecodrix-open");
    // The frame reports replies read only while the chat is on screen.
    const wasOpen = this.isOpen;
    if (wasOpen) this.post({ type: "CLOSE" });
    this.isOpen = false;
    this.iframe.style.opacity = "0";
    this.iframe.style.transform = "scale(0.96) translateY(12px)";
    this.iframe.style.pointerEvents = "none";
    this.iframe.setAttribute("aria-hidden", "true");
    this.iframe.setAttribute("tabindex", "-1");
    this.bubble?.setAttribute("aria-expanded", "false");
    if (this.bubble) this.paint();
    if (wasOpen) this.config.onClose?.();
  }

  /**
   * A message from the chat frame. Trusted only from the iframe this widget
   * opened: its origin (whatever `baseUrl`/`botUrl` pointed at) and its window.
   */
  private onFrameMessage(event: MessageEvent): void {
    if (
      !this.iframe ||
      event.origin !== frameOrigin(this.config.botUrl) ||
      event.source !== this.iframe.contentWindow
    )
      return;
    const data = event.data as Record<string, unknown> | null;
    if (data?.type === "CHAT_WIDGET_CLOSE") this.hideIframe();
    else if (data?.type === "CONFIG") this.applyFrameConfig(data);
  }

  /** The business's saved look from the frame; malformed values are ignored. */
  private applyFrameConfig(d: Record<string, unknown>): void {
    const c = this.config;
    if (typeof d.color === "string" && HEX.test(d.color)) c.bubbleColor = d.color;
    if (d.position === "left" || d.position === "right") {
      const [vertical] = c.bubblePosition.split("-");
      c.bubblePosition = `${vertical}-${d.position}` as BubblePosition;
    }
    if (d.shape === "round" || d.shape === "square" || d.shape === "label") c.shape = d.shape;
    if (typeof d.label === "string") c.label = d.label.trim().slice(0, 30);
    if (d.size === "S" || d.size === "M" || d.size === "L") c.size = d.size;
    if (
      typeof d.icon === "string" &&
      ["chat", "help", "calendar", "phone", "image"].includes(d.icon)
    )
      c.icon = d.icon as LauncherIcon;
    const iconUrl = httpsUrl(d.iconUrl);
    if (iconUrl) c.iconUrl = iconUrl;
    if (c.icon === "image" && !c.iconUrl) c.icon = "chat";
    const bottom = px(d.offsetBottom);
    const side = px(d.offsetSide);
    if (bottom !== undefined) c.offsetBottom = bottom;
    if (side !== undefined) c.offsetSide = side;
    if (Array.isArray(d.hiddenPaths))
      c.hiddenPaths = d.hiddenPaths
        .filter((p): p is string => typeof p === "string" && /^\/\S{0,100}$/.test(p))
        .slice(0, 20);
    if (typeof d.ownButton === "boolean") c.ownButton = d.ownButton;
    const n = d.nudge as { text?: unknown; delay?: unknown } | null | undefined;
    if (n === null) c.nudge = null;
    else if (n && typeof n.text === "string" && n.text.trim())
      c.nudge = { text: n.text.trim().slice(0, 120), delay: px(n.delay, 120) ?? 5 };
    this.hidden = d.hidden === true;

    this.paint();
    this.place();
    this.updateDimensions();
    this.applyVisibility();
    this.reveal();
    this.scheduleNudge();
    // The frame is listening now (it sent this): an OPEN sent while it was
    // still loading was lost, and it needs the page.
    if (this.isOpen) this.post({ type: "OPEN" });
    this.postPage();
  }

  /** Off, on a hidden page, or "own button": the button (and chat) step aside. */
  private applyVisibility(): void {
    if (!this.container) return;
    const away = this.hidden || onHiddenPath(window.location.pathname, this.config.hiddenPaths);
    if (away && this.isOpen) this.hideIframe();
    this.container.style.display = away || this.config.ownButton ? "none" : "";
    if (away) this.dropNudge(false);
  }

  /** The welcome nudge: once per visit, after its delay, only with the button showing. */
  private scheduleNudge(): void {
    if (this.nudgeTimeout) clearTimeout(this.nudgeTimeout);
    this.nudgeTimeout = null;
    const n = this.config.nudge;
    if (!n || this.nudgeBox || this.isOpen) return;
    try {
      if (sessionStorage.getItem(NUDGE_KEY)) return;
    } catch {
      // Storage blocked: show it; it can't be remembered.
    }
    this.nudgeTimeout = setTimeout(() => this.showNudge(n.text), n.delay * 1000);
  }

  private showNudge(text: string): void {
    if (this.isOpen || this.container.style.display === "none") return;
    const box = document.createElement("div");
    box.setAttribute("data-ecodrix-nudge", "");
    box.setAttribute("role", "status");
    const open = document.createElement("button");
    open.type = "button";
    open.setAttribute("data-text", "");
    open.textContent = text;
    open.addEventListener("click", () => this.showIframe());
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.setAttribute("data-dismiss", "");
    dismiss.setAttribute("aria-label", "Dismiss");
    dismiss.textContent = "×";
    dismiss.addEventListener("click", () => this.dropNudge(true));
    box.append(open, dismiss);
    const [vertical, sideName] = this.config.bubblePosition.split("-");
    box.style[vertical === "top" ? "top" : "bottom"] = `${this.size() + 10}px`;
    box.style[sideName === "left" ? "left" : "right"] = "0";
    this.container.appendChild(box);
    this.nudgeBox = box;
  }

  /** Remove the nudge; `seen` = don't show it again this visit. */
  private dropNudge(seen: boolean): void {
    if (this.nudgeTimeout) clearTimeout(this.nudgeTimeout);
    this.nudgeTimeout = null;
    this.nudgeBox?.remove();
    this.nudgeBox = null;
    if (!seen || !this.config.nudge) return;
    try {
      sessionStorage.setItem(NUDGE_KEY, "1");
    } catch {
      // Storage blocked: nothing to remember it in.
    }
  }

  /** Show the button (CONFIG arrived, the 3 s wait ran out, or the chat opened). */
  private reveal(): void {
    if (this.configTimeout) clearTimeout(this.configTimeout);
    this.configTimeout = null;
    if (this.container) this.container.style.visibility = "";
  }

  /** Button and chat window on the configured corner, at the configured distance. */
  private place(): void {
    const [vertical, side] = this.config.bubblePosition.split("-") as [
      "top" | "bottom",
      "left" | "right",
    ];
    const box = this.container.style;
    box.top = box.bottom = box.left = box.right = "";
    box[vertical] = `${this.config.offsetBottom}px`;
    box[side] = `${this.config.offsetSide}px`;
    if (this.iframe) {
      const f = this.iframe.style;
      f.top = f.bottom = f.left = f.right = "";
      f[vertical] = `${this.windowGap()}px`;
      f[side] = `${Math.max(16, this.config.offsetSide)}px`;
      f.transformOrigin = `${vertical} ${side}`;
    }
  }

  /**
   * Tell the chat which page the visitor is on (C9): the path only, since a
   * query string or hash can carry tokens or personal data. Sent to the
   * frame's origin only.
   */
  private postPage(): void {
    this.post({
      type: "PAGE",
      path: window.location.pathname.slice(0, 200),
      title: document.title.slice(0, 120),
    });
  }

  /** A message to the chat frame, delivered only if it's on the frame's origin. */
  private post(data: { type: string; [key: string]: unknown }): void {
    const origin = frameOrigin(this.config.botUrl);
    if (origin) this.iframe?.contentWindow?.postMessage(data, origin);
  }

  /** Whether the chat iframe is currently open. */
  isIframeVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Merge new config and hot-apply it (URL, look, accessible name) without a
   * full re-init.
   */
  updateConfig(next: Partial<ECODrIxWidgetConfig> = {}): void {
    this.config = { ...this.config, ...next } as ResolvedConfig;
    // Re-resolve the URL when any URL-affecting field changed. An explicit
    // `next.botUrl` wins; otherwise rebuild from the (possibly updated)
    // clientCode/baseUrl rather than the stale stored botUrl.
    if (next.botUrl || next.clientCode || next.baseUrl) {
      const url = resolveWidgetUrl({
        botUrl: next.botUrl,
        clientCode: this.config.clientCode,
        baseUrl: this.config.baseUrl,
      });
      if (url) {
        this.config.botUrl = url;
        if (this.iframe) this.iframe.src = url;
      }
    }
    if (!this.bubble) return;
    this.paint();
    this.place();
    this.updateDimensions();
    this.applyVisibility();
  }

  destroy(): boolean {
    this.listeners?.abort();
    this.listeners = null;
    document.documentElement.removeAttribute("data-ecodrix-open");
    if (this.iframe) this.iframe.remove();
    this.iframe = null;
    if (this.container) this.container.remove();
    if (this.autoOpenTimeout) clearTimeout(this.autoOpenTimeout);
    if (this.configTimeout) clearTimeout(this.configTimeout);
    if (this.nudgeTimeout) clearTimeout(this.nudgeTimeout);
    const styles = document.getElementById("ecodrix-widget-styles");
    if (styles) styles.remove();
    activeWidget = null;
    return true;
  }
}

/** The CDN global surface (`window.ECODrIx`). */
export interface ECODrIxGlobal {
  init(config: ECODrIxWidgetConfig): ECODrIxWidget;
  destroy(): void;
  show(): void;
  hide(): void;
  toggle(): void;
  isOpen(): boolean;
  updateConfig(config: Partial<ECODrIxWidgetConfig>): void;
}

declare global {
  interface Window {
    ECODrIx?: ECODrIxGlobal;
  }
}

/**
 * The one-line embed: `<script src="…/v2.js" data-erix="CLIENT_CODE" async>`.
 * `document.currentScript` is only set while this file first runs, so it's
 * read then; the widget starts once the page has a body. Never a second
 * widget: an earlier `ECODrIx.init` (or another copy of this script) wins.
 */
function autoStart(script: Element | null): void {
  const clientCode = (script as HTMLScriptElement | null)?.dataset?.erix?.trim();
  if (!clientCode) return;
  // `init` returns the running widget when there is one (no second bubble).
  const start = () => window.ECODrIx?.init({ clientCode });
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

/** The page's one widget: `window.ECODrIx`, also importable from bundlers. */
export const ECODrIx: ECODrIxGlobal = {
  init: (opts: ECODrIxWidgetConfig) => {
    activeWidget = new ECODrIxWidget(opts);
    activeWidget.init();
    return activeWidget;
  },
  destroy: () => activeWidget?.destroy(),
  show: () => activeWidget?.showIframe(),
  hide: () => activeWidget?.hideIframe(),
  toggle: () => activeWidget?.toggleIframe(),
  isOpen: () => activeWidget?.isIframeVisible() ?? false,
  updateConfig: (opts: Partial<ECODrIxWidgetConfig>) => activeWidget?.updateConfig(opts),
};

// CDN / global attach — the side effect the `<script>` embed relies on. A
// second copy of this script (two tags, or npm plus CDN) keeps the first
// copy's global, so the page still gets one widget.
if (typeof window !== "undefined") {
  window.ECODrIx ??= ECODrIx;
  autoStart(document.currentScript);
}

export { ECODrIxWidget as ECODrIxChat };
