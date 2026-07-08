/**
 * @module @ecodrix/chatbot/react
 * React / Next.js bindings. The widget mounts imperatively to `document.body`,
 * so these render NOTHING (return null) — they own the widget lifecycle
 * (mount → destroy) and hot-apply prop changes. SSR-safe (the widget is only
 * created inside `useEffect`, which never runs on the server). Use inside a
 * Client Component (`"use client"`).
 */

import { useEffect, useRef } from "react";
import {
  ECODrIxChat as ECODrIxWidget,
  type ECODrIxWidgetConfig,
} from "./index.js";

/** Props for {@link ECODrIxChat} — every widget config field. */
export type ECODrIxChatProps = ECODrIxWidgetConfig;

/** Programmatic controls returned by {@link useECODrIxChat}. */
export interface ECODrIxChatControls {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  update(next: Partial<ECODrIxWidgetConfig>): void;
}

/**
 * Declarative chat widget. Renders `null`; the floating bubble mounts to
 * `document.body`.
 *
 * @example
 * ```tsx
 * "use client";
 * import { ECODrIxChat } from "@ecodrix/chatbot/react";
 * export default () => <ECODrIxChat clientCode="ACME123" />;
 * ```
 */
export function ECODrIxChat(props: ECODrIxChatProps): null {
  const widgetRef = useRef<ECODrIxWidget | null>(null);

  // Mount once on the client; tear down on unmount.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const widget = new ECODrIxWidget(props);
    widget.init();
    widgetRef.current = widget;
    return () => {
      widget.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hot-apply the props that can change without a re-init.
  useEffect(() => {
    widgetRef.current?.updateConfig(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clientCode, props.botUrl, props.baseUrl, props.tooltipText]);

  return null;
}

/**
 * Imperative hook — mounts the widget and returns programmatic controls.
 */
export function useECODrIxChat(
  config: ECODrIxWidgetConfig,
): ECODrIxChatControls {
  const widgetRef = useRef<ECODrIxWidget | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const widget = new ECODrIxWidget(config);
    widget.init();
    widgetRef.current = widget;
    return () => {
      widget.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    open: () => widgetRef.current?.showIframe(),
    close: () => widgetRef.current?.hideIframe(),
    toggle: () => widgetRef.current?.toggleIframe(),
    isOpen: () => widgetRef.current?.isIframeVisible() ?? false,
    update: (next) => widgetRef.current?.updateConfig(next),
  };
}

export default ECODrIxChat;
