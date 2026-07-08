/**
 * @module @ecodrix/chatbot
 * ECODrIx chat widget — a lightweight, dependency-free floating chat bubble that
 * opens the hosted chat iframe. Usable via CDN (`window.ECODrIx.init`), any
 * bundler (ESM/CJS), or the React entry (`@ecodrix/chatbot/react`).
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
  /** Base origin of the ECODrIx app. Default `https://app.ecodrix.com`. */
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
  /** Chat iframe width in px. */
  iframeWidth?: number;
  /** Chat iframe height in px. */
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
  bubbleColor: "#4f46e5",
  iconColor: "#ffffff",
  pulseColor: "#34d399",
  tooltipText: "Chat with us!",
  tooltipColor: "#333333",
  tooltipBgColor: "#ffffff",
  closeClickOutside: true,
  bubbleSize: 56,
  bubblePosition: "bottom-right" as BubblePosition,
  iframeWidth: 340,
  iframeHeight: 500,
  iframeBorderRadius: 8,
  autoOpen: 0,
  shadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
  bubbleShadow: "0 10px 40px rgba(0,0,0,0.2)",
  baseUrl: "https://app.ecodrix.com",
};

type ResolvedConfig = typeof DEFAULTS & ECODrIxWidgetConfig;

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
  private iframe: HTMLIFrameElement | null = null;
  private autoOpenTimeout: ReturnType<typeof setTimeout> | null = null;
  private isOpen = false;

  constructor(config: ECODrIxWidgetConfig) {
    if (activeWidget) return activeWidget;

    this.config = { ...DEFAULTS, ...config };
    this.config.botUrl = resolveWidgetUrl(this.config);

    window.addEventListener("message", (event: MessageEvent) => {
      if (
        event.origin !== "https://console.ecodrix.com" &&
        event.origin !== "http://localhost:3000"
      )
        return;
      if ((event.data as { type?: string })?.type === "CHAT_WIDGET_CLOSE")
        this.hideIframe();
    });

    window.addEventListener("resize", () => this.updateDimensions());
    window.addEventListener("orientationchange", () => this.updateDimensions());
  }

  init(): void {
    if (!this.config.botUrl) {
      throw new Error(
        "[ECODrIx] Provide `clientCode` (recommended) or `botUrl`.",
      );
    }
    this.updateDimensions();
    this.addStyles();
    this.createBubble();
    this.preloadIframe();

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
        0% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4); }
        70% { box-shadow: 0 0 0 15px rgba(79, 70, 229, 0); }
        100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
      }
      [data-ecodrix-bubble]:focus-visible {
        outline: 3px solid rgba(79, 70, 229, 0.6);
        outline-offset: 3px;
      }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.id = "ecodrix-widget-styles";
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  private createBubble(): void {
    this.bubbleContainer = document.createElement("div");
    const pos = this.config.bubblePosition.split("-");
    this.bubbleContainer.style.cssText = `
      position: fixed;
      ${pos[0]}: 24px;
      ${pos[1]}: 16px;
      width: ${this.config.bubbleSize}px;
      height: ${this.config.bubbleSize}px;
      z-index: 100000;
      pointer-events: auto;
    `;

    this.bubble = document.createElement("div");
    this.bubble.style.cssText = `
      width: ${this.config.bubbleSize}px;
      height: ${this.config.bubbleSize}px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${this.config.bubbleColor}, ${this.shadeColor(
        this.config.bubbleColor,
        -20,
      )});
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
    this.bubbleContainer.appendChild(this.bubble);
    document.body.appendChild(this.bubbleContainer);

    this.tooltip = document.createElement("div");
    this.tooltip.innerText = this.config.tooltipText;
    this.tooltip.style.cssText = `
      position: absolute;
      top: 50%;
      right: calc(100% + 8px);
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
    const arrow = document.createElement("div");
    arrow.style.cssText = `
      position: absolute; width: 0; height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 5px solid ${this.config.tooltipBgColor};
      right: -5px; top: 50%; transform: translateY(-50%);
    `;
    this.tooltip.appendChild(arrow);
    this.bubbleContainer.appendChild(this.tooltip);

    this.bubble.addEventListener("mouseenter", () => {
      if (this.isOpen) return;
      this.bubble.style.transform = "scale(1.1)";
      this.iconContainer.style.transform = "scale(1.1)";
      this.tooltip.style.opacity = "1";
      this.tooltip.style.transform = "translateY(-50%) translateX(-5px)";
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
    this.iframe.src = this.config.botUrl as string;
    this.iframe.allow = "microphone";
    this.iframe.title = this.config.tooltipText || "Chat";
    // Closed by default — keep it out of the tab order + hidden from AT.
    this.iframe.setAttribute("aria-hidden", "true");
    this.iframe.setAttribute("tabindex", "-1");
    this.iframe.style.cssText = `
      position: fixed;
      bottom: ${this.config.bubbleSize + 24}px;
      right: 16px;
      width: ${this.config.iframeWidth}px;
      height: ${this.config.iframeHeight}px;
      border: none;
      border-radius: ${this.config.iframeBorderRadius}px;
      box-shadow: ${this.config.shadow};
      z-index: 99999;
      opacity: 0;
      transform: scale(0.8) translateY(20px);
      transform-origin: bottom right;
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
    this.isOpen = false;
    this.iframe.style.opacity = "0";
    this.iframe.style.transform = "scale(0.8) translateY(20px)";
    this.iframe.style.pointerEvents = "none";
    this.iframe.setAttribute("aria-hidden", "true");
    this.iframe.setAttribute("tabindex", "-1");
    this.bubble?.setAttribute("aria-expanded", "false");
    this.config.onClose?.();
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
    if (this.iframe) this.iframe.remove();
    if (this.bubbleContainer) this.bubbleContainer.remove();
    if (this.autoOpenTimeout) clearTimeout(this.autoOpenTimeout);
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

// CDN / global attach — the side effect the `<script>` embed relies on.
if (typeof window !== "undefined") {
  window.ECODrIx = {
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
}

export { ECODrIxWidget as ECODrIxChat };
