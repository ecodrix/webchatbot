/**
 * @module @ecodrix/chatbot
 * ECODrIx chat widget — a lightweight, dependency-free floating chat bubble that
 * opens the hosted chat iframe. Usable via the one-line CDN tag
 * (`<script src="…/v2.js" data-erix="CLIENT_CODE" async></script>`, starts
 * itself), `window.ECODrIx.init`, any bundler (ESM/CJS), or the React entry
 * (`@ecodrix/chatbot/react`).
 *
 * postMessage protocol with the hosted frame (`/widget-frame`). Messages in
 * are trusted only from the iframe this widget opened (its origin AND its
 * window); messages out go to that origin only.
 *   frame → widget  CHAT_WIDGET_CLOSE              close (Esc / close button)
 *   frame → widget  CONFIG { color?, position? }   the business's colour (#rrggbb)
 *                                                  and side ("left" | "right")
 *   widget → frame  OPEN                           the visitor opened the chat
 *                                                  (again on CONFIG if already
 *                                                  open): the frame goes live
 *   widget → frame  PAGE { path, title }           on open, on CONFIG and on
 *                                                  popstate/hashchange; path
 *                                                  only (no query or hash)
 *
 * On phones (viewport ≤ 480 px) the open chat is a full-screen sheet inside
 * the safe area, and the host page doesn't scroll behind it.
 */

/** Bubble screen position. */
export type BubblePosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

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

  // ── Appearance ──────────────────────────────────────────────────────────
  /** Emoji, SVG string, or image URL for the bubble icon. */
  bubbleIcon?: string;
  /** Base color for the bubble gradient. */
  bubbleColor?: string;
  /** Icon color inside the bubble. */
  iconColor?: string;
  /** Pulse/ripple color. */
  pulseColor?: string;
  /** Hover tooltip text. */
  tooltipText?: string;
  /** Tooltip text color. */
  tooltipColor?: string;
  /** Tooltip background color. */
  tooltipBgColor?: string;
  /** Bubble diameter in px. */
  bubbleSize?: number;
  /** Screen corner. */
  bubblePosition?: BubblePosition;
  /** Chat iframe width in px (default 380, kept inside the viewport). */
  iframeWidth?: number;
  /** Chat iframe height in px (default 600, kept inside the viewport). */
  iframeHeight?: number;
  /** Iframe border radius in px. */
  iframeBorderRadius?: number;
  /** Iframe box-shadow. */
  shadow?: string;
  /** Bubble box-shadow. */
  bubbleShadow?: string;
  /** Close iframe on outside click. */
  closeClickOutside?: boolean;
  /** Auto-open after N seconds (0 = disabled). */
  autoOpen?: number;
}

const DEFAULTS = {
  bubbleIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-icon"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>`,
  // ERIX blue (`--primary`): the console's default colour and the frame's
  // default visitor bubble, so a business with no colour saved sees one blue.
  bubbleColor: "#2b4dcb",
  iconColor: "#ffffff",
  pulseColor: "#34d399",
  tooltipText: "Chat with us!",
  tooltipColor: "#333333",
  tooltipBgColor: "#ffffff",
  closeClickOutside: true,
  bubbleSize: 56,
  bubblePosition: "bottom-right" as BubblePosition,
  iframeWidth: 380,
  iframeHeight: 600,
  iframeBorderRadius: 8,
  autoOpen: 0,
  shadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
  bubbleShadow: "0 10px 40px rgba(0,0,0,0.2)",
  baseUrl: "https://console.ecodrix.com",
};

type ResolvedConfig = typeof DEFAULTS & ECODrIxWidgetConfig;

/** Origin of the widget iframe URL, or "" when there's no valid URL. */
function frameOrigin(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

/** How long the bubble waits for the frame's CONFIG before showing the defaults. */
const CONFIG_TIMEOUT_MS = 3000;
const HEX = /^#[0-9a-f]{6}$/i;

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
  private bubbleContainer!: HTMLDivElement;
  private bubble!: HTMLDivElement;
  private iconContainer!: HTMLDivElement;
  private tooltip!: HTMLDivElement;
  private tooltipArrow!: HTMLDivElement;
  private iframe: HTMLIFrameElement | null = null;
  private autoOpenTimeout: ReturnType<typeof setTimeout> | null = null;
  private configTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Set while running: removes every window listener on destroy. */
  private listeners: AbortController | null = null;
  private isOpen = false;

  constructor(config: ECODrIxWidgetConfig) {
    if (activeWidget) return activeWidget;

    this.config = { ...DEFAULTS, ...config };
    this.config.botUrl = resolveWidgetUrl(this.config);
  }

  init(): void {
    // Already running (a second init, or the one-line tag plus init): one
    // bubble, one iframe.
    if (this.listeners) return;
    if (!this.config.botUrl) {
      throw new Error(
        "[ECODrIx] Provide `clientCode` (recommended) or `botUrl`.",
      );
    }
    this.listeners = new AbortController();
    const on = { signal: this.listeners.signal };
    window.addEventListener("message", (e) => this.onFrameMessage(e), on);
    window.addEventListener("resize", () => this.updateDimensions(), on);
    window.addEventListener(
      "orientationchange",
      () => this.updateDimensions(),
      on,
    );
    // A single-page site moved on: the chat gets the new page.
    // ponytail: history.pushState fires no event, so an SPA's in-app link
    // while the chat is open isn't seen (PAGE is re-sent on every open) —
    // wrap pushState/replaceState if stale page context shows up.
    window.addEventListener("popstate", () => this.postPage(), on);
    window.addEventListener("hashchange", () => this.postPage(), on);

    this.addStyles();
    this.createBubble();
    this.preloadIframe();
    this.place();
    // After the iframe exists — before, the phone sizing silently no-op'd.
    this.updateDimensions();
    // The bubble stays hidden until the frame sends the business's colour
    // and side (CONFIG), so it never flashes the wrong colour; defaults after 3 s.
    this.configTimeout = setTimeout(() => this.reveal(), CONFIG_TIMEOUT_MS);

    if (this.config.autoOpen > 0) {
      this.autoOpenTimeout = setTimeout(
        () => this.showIframe(),
        this.config.autoOpen * 1000,
      );
    }
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
    // Small laptop screens: the window sits above the bubble (bubble + 24 px
    // from the edge) and keeps 16 px from the other edges.
    iframeWidth = Math.min(iframeWidth, vw - 32);
    iframeHeight = Math.min(iframeHeight, vh - this.config.bubbleSize - 24 - 16);
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
      @keyframes ecodrix-bubble-float {
        0% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-5px) scale(1.02); }
        100% { transform: translateY(0px) scale(1); }
      }
      @keyframes ecodrix-bubble-pulse {
        0% { box-shadow: 0 0 0 0 rgba(43, 77, 203, 0.4); }
        70% { box-shadow: 0 0 0 15px rgba(43, 77, 203, 0); }
        100% { box-shadow: 0 0 0 0 rgba(43, 77, 203, 0); }
      }
      [data-ecodrix-bubble]:focus-visible {
        outline: 3px solid rgba(43, 77, 203, 0.6);
        outline-offset: 3px;
      }
      /* Phones: the open chat fills the screen inside the safe area (notch,
         home bar), above the bubble, and the page behind it doesn't scroll.
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
    this.bubbleContainer = document.createElement("div");
    this.bubbleContainer.style.cssText = `
      position: fixed;
      width: ${this.config.bubbleSize}px;
      height: ${this.config.bubbleSize}px;
      z-index: 100000;
      pointer-events: auto;
      visibility: hidden;
    `;

    this.bubble = document.createElement("div");
    this.bubble.style.cssText = `
      width: ${this.config.bubbleSize}px;
      height: ${this.config.bubbleSize}px;
      border-radius: 50%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      overflow: visible;
      transition: all 0.4s cubic-bezier(0.4,0,0.2,1);
      box-shadow: ${this.config.bubbleShadow};
    `;

    // Accessibility: a div-with-onclick is invisible to keyboards + screen
    // readers, so expose it as a labeled, focusable button.
    this.bubble.setAttribute("data-ecodrix-bubble", "");
    this.bubble.setAttribute("role", "button");
    this.bubble.setAttribute("tabindex", "0");
    this.bubble.setAttribute("aria-label", this.config.tooltipText);
    this.bubble.setAttribute("aria-expanded", "false");
    this.bubble.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleIframe();
        // Keyboard users land in the chat box (the frame focuses its input).
        if (this.isOpen) this.iframe?.focus();
      }
    });

    this.iconContainer = document.createElement("div");
    this.iconContainer.style.cssText = `
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.3s ease;
    `;
    this.iconContainer.innerHTML = this.config.bubbleIcon;
    this.bubble.appendChild(this.iconContainer);
    this.paintBubble();
    this.bubbleContainer.appendChild(this.bubble);
    document.body.appendChild(this.bubbleContainer);

    this.tooltip = document.createElement("div");
    this.tooltip.innerText = this.config.tooltipText;
    this.tooltip.style.cssText = `
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background-color: ${this.config.tooltipBgColor};
      color: ${this.config.tooltipColor};
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 100001;
    `;
    this.tooltipArrow = document.createElement("div");
    this.tooltipArrow.style.cssText = `
      position: absolute; width: 0; height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      top: 50%; transform: translateY(-50%);
    `;
    this.tooltip.appendChild(this.tooltipArrow);
    this.bubbleContainer.appendChild(this.tooltip);

    this.bubble.addEventListener("mouseenter", () => {
      if (this.isOpen) return;
      this.bubble.style.transform = "scale(1.1)";
      this.iconContainer.style.transform = "scale(1.1)";
      this.tooltip.style.opacity = "1";
      // Nudge away from the bubble, towards the page.
      const away = this.config.bubblePosition.endsWith("left") ? 5 : -5;
      this.tooltip.style.transform = `translateY(-50%) translateX(${away}px)`;
    });
    this.bubble.addEventListener("mouseleave", () => {
      if (this.isOpen) return;
      this.bubble.style.transform = "scale(1)";
      this.iconContainer.style.transform = "scale(1)";
      this.tooltip.style.opacity = "0";
      this.tooltip.style.transform = "translateY(-50%) translateX(0)";
    });

    this.bubble.addEventListener("click", () => this.toggleIframe());
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
      transform: scale(0.8) translateY(20px);
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      background: white;
    `;
    document.body.appendChild(this.iframe);
  }

  toggleIframe(): void {
    if (this.isOpen) this.hideIframe();
    else this.showIframe();
  }

  showIframe(): void {
    if (!this.iframe) return;
    this.reveal();
    // The frame opens its live connection only now (it's preloaded, hidden,
    // on every page view).
    this.post({ type: "OPEN" });
    this.postPage();
    document.documentElement.setAttribute("data-ecodrix-open", "");
    this.isOpen = true;
    this.tooltip.style.opacity = "0";
    this.bubble.style.transform = "scale(1)";
    this.iframe.style.opacity = "1";
    this.iframe.style.transform = "scale(1) translateY(0)";
    this.iframe.style.pointerEvents = "auto";
    this.iframe.setAttribute("aria-hidden", "false");
    this.iframe.removeAttribute("tabindex");
    this.bubble?.setAttribute("aria-expanded", "true");
    this.config.onOpen?.();
  }

  hideIframe(): void {
    if (!this.iframe) return;
    // Closing from inside the chat (Esc / close button) must not drop focus.
    if (document.activeElement === this.iframe) this.bubble?.focus();
    document.documentElement.removeAttribute("data-ecodrix-open");
    this.isOpen = false;
    this.iframe.style.opacity = "0";
    this.iframe.style.transform = "scale(0.8) translateY(20px)";
    this.iframe.style.pointerEvents = "none";
    this.iframe.setAttribute("aria-hidden", "true");
    this.iframe.setAttribute("tabindex", "-1");
    this.bubble?.setAttribute("aria-expanded", "false");
    this.config.onClose?.();
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
    const data = event.data as {
      type?: unknown;
      color?: unknown;
      position?: unknown;
    } | null;
    if (data?.type === "CHAT_WIDGET_CLOSE") this.hideIframe();
    else if (data?.type === "CONFIG") this.applyFrameConfig(data);
  }

  /** The business's colour and side from the frame (ignored when malformed). */
  private applyFrameConfig(data: { color?: unknown; position?: unknown }): void {
    if (typeof data.color === "string" && HEX.test(data.color)) {
      this.config.bubbleColor = data.color;
      this.paintBubble();
    }
    if (data.position === "left" || data.position === "right") {
      const [vertical] = this.config.bubblePosition.split("-");
      this.config.bubblePosition = `${vertical}-${data.position}` as BubblePosition;
      this.place();
    }
    this.reveal();
    // The frame is listening now (it sent this): an OPEN sent while it was
    // still loading was lost, and it needs the page.
    if (this.isOpen) this.post({ type: "OPEN" });
    this.postPage();
  }

  /** Show the bubble (CONFIG arrived, the 3 s wait ran out, or the chat opened). */
  private reveal(): void {
    if (this.configTimeout) clearTimeout(this.configTimeout);
    this.configTimeout = null;
    if (this.bubbleContainer) this.bubbleContainer.style.visibility = "";
  }

  private paintBubble(): void {
    const c = this.config.bubbleColor;
    this.bubble.style.background = `linear-gradient(135deg, ${c}, ${this.shadeColor(c, -20)})`;
  }

  /** Bubble, chat window and tooltip on the configured corner. */
  private place(): void {
    const [vertical, side] = this.config.bubblePosition.split("-") as [
      "top" | "bottom",
      "left" | "right",
    ];
    const inner = side === "left" ? "right" : "left";
    const box = this.bubbleContainer.style;
    box.top = box.bottom = box.left = box.right = "";
    box[vertical] = "24px";
    box[side] = "16px";
    if (this.iframe) {
      const f = this.iframe.style;
      f.top = f.bottom = f.left = f.right = "";
      f[vertical] = `${this.config.bubbleSize + 24}px`;
      f[side] = "16px";
      f.transformOrigin = `${vertical} ${side}`;
    }
    // The tooltip sits on the page side of the bubble, its arrow pointing back.
    const tip = this.tooltip.style;
    tip.left = tip.right = "";
    tip[inner] = "calc(100% + 8px)";
    const arrow = this.tooltipArrow.style;
    arrow.left = arrow.right = arrow.borderLeft = arrow.borderRight = "";
    arrow[side] = "-5px";
    arrow[side === "left" ? "borderRight" : "borderLeft"] =
      `5px solid ${this.config.tooltipBgColor}`;
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
   * Merge new config and hot-apply the safe fields (URL, tooltip) without a
   * full re-init.
   */
  updateConfig(next: Partial<ECODrIxWidgetConfig> = {}): void {
    this.config = { ...this.config, ...next };
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
    if (next.tooltipText && this.tooltip) {
      this.tooltip.childNodes[0].nodeValue = next.tooltipText;
      this.bubble?.setAttribute("aria-label", next.tooltipText);
    }
  }

  private shadeColor(color: string, percent: number): string {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);
    R = Math.min(255, Math.round((R * (100 + percent)) / 100));
    G = Math.min(255, Math.round((G * (100 + percent)) / 100));
    B = Math.min(255, Math.round((B * (100 + percent)) / 100));
    const RR = R.toString(16).padStart(2, "0");
    const GG = G.toString(16).padStart(2, "0");
    const BB = B.toString(16).padStart(2, "0");
    return `#${RR}${GG}${BB}`;
  }

  destroy(): boolean {
    this.listeners?.abort();
    this.listeners = null;
    document.documentElement.removeAttribute("data-ecodrix-open");
    if (this.iframe) this.iframe.remove();
    this.iframe = null;
    if (this.bubbleContainer) this.bubbleContainer.remove();
    if (this.autoOpenTimeout) clearTimeout(this.autoOpenTimeout);
    if (this.configTimeout) clearTimeout(this.configTimeout);
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
  updateConfig: (opts: Partial<ECODrIxWidgetConfig>) =>
    activeWidget?.updateConfig(opts),
};

// CDN / global attach — the side effect the `<script>` embed relies on. A
// second copy of this script (two tags, or npm plus CDN) keeps the first
// copy's global, so the page still gets one widget.
if (typeof window !== "undefined") {
  window.ECODrIx ??= ECODrIx;
  autoStart(document.currentScript);
}

export { ECODrIxWidget as ECODrIxChat };
