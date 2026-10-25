# 🧠 ECODrIx Chatbot SDK

> A **lightweight, dependency-free JavaScript SDK** for embedding the [ECODrIx Chatbot](https://console.ecodrix.com) widget into _any_ website or framework — with elegance, speed, and full customization.

[![npm version](https://img.shields.io/npm/v/ecodrix-sdk.svg?color=4f46e5&style=flat-square)](https://www.npmjs.com/package/@ecodrix/chatbot)
[![license](https://img.shields.io/badge/license-MIT-success.svg?style=flat-square)](LICENSE)
[![build](https://img.shields.io/badge/build-tsup-orange.svg?style=flat-square)](https://tsup.egoist.dev)

---

## ✨ Overview

The **ECODrIx SDK** makes it effortless to drop an AI-powered chatbot onto your site.  
With a few lines of JavaScript, you can add a floating chat bubble that opens an iframe chat window — beautifully animated, mobile-friendly, and fully customizable.

✅ **No dependencies**  
✅ **Works with React, Vue, Next.js, static HTML**  
✅ **Custom bubble colors, tooltips, and icons**  
✅ **Responsive iframe and smooth animations**  
✅ **Auto-open timer & click-outside-to-close behavior**

---

## 🚀 Installation

You can install the SDK using **npm** or a **CDN** link.

#### Option 1 — NPM (recommended)

```bash
pnpm add @ecodrix/chatbot

npm install @ecodrix/chatbot

```

#### Option 2 — One line (recommended for websites)

Paste this before `</body>`, with your client code (Settings → Developer, or
Connect → Website chat):

```html
<script src="https://cdn.ecodrix.com/chatbot/v2.js" data-erix="CLIENT_CODE" async></script>
```

The widget starts itself. Its name, greeting, colour, side (left/right), logo
and business hours come from your Website chat settings in ECODrIx, so you
never edit the tag to change them. The bubble stays hidden until those
settings arrive (at most 3 seconds), so it never shows the wrong colour.

`v2.js` always serves the latest 2.x release. To pin a version, use the
versioned file with its integrity hash (shown under "Pinned version" in
Connect → Website chat) and update the tag yourself to get fixes:

```html
<script
  src="https://cdn.ecodrix.com/chatbot/v2.N.M.js"
  integrity="sha384-…"
  crossorigin="anonymous"
  data-erix="CLIENT_CODE"
  async
></script>
```

The same build is on npm CDNs as `dist/index.global.js` (for example
`https://cdn.jsdelivr.net/npm/@ecodrix/chatbot@2/dist/index.global.js`), and
`data-erix` works there too.

### 🧩 Basic Usage

> **Recommended:** pass your **`clientCode`** (your public workspace id, from
> Settings → Developer). The SDK builds the hosted widget URL for you — no need
> to hand-craft `botUrl`. Messages land in your ECODrIx inbox.

#### ES Module (modern frameworks)

```tsx
import { ECODrIx } from "@ecodrix/chatbot";

ECODrIx.init({
  clientCode: "ACME123", // ← recommended; derives the widget URL
  bubbleColor: "#4f46e5",
  bubblePosition: "bottom-right",
  autoOpen: 10, // auto-open after 10 seconds
  onOpen: () => console.log("chat opened"),
});
```

#### React / Next.js (first-class)

A dedicated entry ships a component + hook (React is an optional peer dep):

```tsx
"use client";
import { ECODrIxChat } from "@ecodrix/chatbot/react";

export default function Layout() {
  return <ECODrIxChat clientCode="ACME123" bubbleColor="#4f46e5" />;
}
```

Imperative control via the hook:

```tsx
"use client";
import { useECODrIxChat } from "@ecodrix/chatbot/react";

function HelpButton() {
  const chat = useECODrIxChat({ clientCode: "ACME123" });
  return <button onClick={chat.open}>Need help?</button>;
}
```

The component renders nothing (the floating bubble mounts to `document.body`) and
is SSR-safe — the widget is only created client-side.

#### Global Script (CDN, two tags)

Existing two-tag embeds keep working. Use this form when you need the options
below; don't add `data-erix` as well (one widget per page either way).

```html
<script src="https://cdn.jsdelivr.net/npm/@ecodrix/chatbot@2/dist/index.global.js"></script>

<script>
  ECODrIx.init({
    clientCode: "CLIENT_CODE",
    autoOpen: 8,
  });
</script>
```

A colour or side saved in your Website chat settings replaces `bubbleColor`
and the left/right part of `bubblePosition`.

#### Programmatic Control

```ts
ECODrIx.show(); // Open the iframe
ECODrIx.hide(); // Hide the iframe
ECODrIx.destroy(); // Remove the widget completely
```

#### ⚙️ Configuration Options

| Option                 | Type                                                           | Default                               | Description                                                                                         |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **clientCode**         | `string`                                                       | —                                     | Public workspace id — SDK derives the widget URL _(recommended; one of clientCode/botUrl required)_ |
| **baseUrl**            | `string`                                                       | `"https://console.ecodrix.com"`           | ECODrIx app origin used with `clientCode`                                                           |
| **botUrl**             | `string`                                                       | —                                     | Explicit iframe URL _(advanced; optional when `clientCode` is set)_                                 |
| **onOpen**             | `() => void`                                                   | —                                     | Called when the chat window opens                                                                   |
| **onClose**            | `() => void`                                                   | —                                     | Called when the chat window closes                                                                  |
| **bubbleIcon**         | `string`                                                       | `"💬"`                                | Emoji, SVG string, or image URL                                                                     |
| **bubbleColor**        | `string`                                                       | `"#2b4dcb"`                           | Base color for the chat bubble                                                                      |
| **iconColor**          | `string`                                                       | `"#ffffff"`                           | Color for icon inside bubble                                                                        |
| **pulseColor**         | `string`                                                       | `"#34d399"`                           | Pulse/ripple effect color                                                                           |
| **tooltipText**        | `string`                                                       | `"Chat with us!"`                     | Hover tooltip text                                                                                  |
| **tooltipColor**       | `string`                                                       | `"#333333"`                           | Tooltip text color                                                                                  |
| **tooltipBgColor**     | `string`                                                       | `"#ffffff"`                           | Tooltip background color                                                                            |
| **bubbleSize**         | `number`                                                       | `56`                                  | Diameter of bubble in pixels                                                                        |
| **bubblePosition**     | `"bottom-left"`, `"bottom-right"`, `"top-left"`, `"top-right"` | `"bottom-right"`                      | Screen corner position                                                                              |
| **iframeWidth**        | `number`                                                       | `380`                                 | Width of chat iframe, kept in the viewport                                                            |
| **iframeHeight**       | `number`                                                       | `600`                                 | Height of chat iframe, kept in the viewport                                                           |
| **iframeBorderRadius** | `number`                                                       | `8`                                   | Iframe border radius in px                                                                          |
| **shadow**             | `string`                                                       | `"0 25px 50px -12px rgba(0,0,0,0.4)"` | Shadow under iframe                                                                                 |
| **bubbleShadow**       | `string`                                                       | `"0 10px 40px rgba(0,0,0,0.2)"`       | Shadow under bubble                                                                                 |
| **ripple**             | `boolean`                                                      | `true`                                | Enable ripple animation                                                                             |
| **rippleSpeed**        | `number`                                                       | `1.5`                                 | Ripple speed multiplier                                                                             |
| **autoOpen**           | `number`                                                       | `0`                                   | Seconds before iframe auto-opens                                                                    |
| **closeClickOutside**  | `boolean`                                                      | `true`                                | Close iframe on outside click                                                                       |

#### 💻 Advanced Example

```tsx
import { ECODrIx } from "@ecodrix/chatbot";
```

```tsx
const chatbot = ECODrIx.init({
  clientCode: "CLIENT_CODE",
  bubbleIcon: "<svg>...</svg>",
  bubbleColor: "#9333ea",
  tooltipText: "Need help?",
  tooltipBgColor: "#111827",
  tooltipColor: "#ffffff",
  shadow: "0 15px 40px rgba(0,0,0,0.3)",
  autoOpen: 5,
});
```

```ts
// Dynamically update configuration
chatbot.updateConfig({
  bubbleColor: "#2563eb",
  tooltipText: "Chat is live!",
});
```

### 🧱 Integration Examples

#### React/NextJS

Use the dedicated `@ecodrix/chatbot/react` entry (no manual `useEffect` wiring):

```tsx
"use client";
import { ECODrIxChat } from "@ecodrix/chatbot/react";

export default function App() {
  return (
    <>
      <YourApp />
      <ECODrIxChat clientCode="ACME123" bubbleColor="#4f46e5" />
    </>
  );
}
```

#### Vue.js

```js
import { ECODrIx } from "@ecodrix/chatbot";

export default {
  mounted() {
    ECODrIx.init({
      clientCode: "CLIENT_CODE",
      bubbleColor: "#4f46e5",
    });
  },
};
```

#### Static HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <title>My Site</title>
  </head>
  <body>
    <script src="https://cdn.ecodrix.com/chatbot/v2.js" data-erix="CLIENT_CODE" async></script>
  </body>
</html>
```

#### 🧠 How It Works

Under the hood, the SDK:

- Creates a floating bubble button (a labelled button with `aria-expanded`;
  Enter or Space opens the chat and moves focus into it, Esc closes it and
  returns focus to the bubble)
- Preloads the chat iframe for instant open. The chat reads the visitor's
  thread once; it connects for live replies only when the visitor opens it
  (or starts typing), so page views without a chat cost one read.
- On phones (screen width up to 480 px) the open chat fills the screen, inside
  the safe area (notch, home bar), and the page behind it doesn't scroll.
  Closing restores the page.
- Talks to the chat iframe with `postMessage`, trusting only the iframe it
  opened (its origin and its window):
  - from the chat: `CHAT_WIDGET_CLOSE`, and `CONFIG { color, position }` with
    your saved colour and side;
  - to the chat: `OPEN` when the visitor opens it, and `PAGE { path, title }`
    when the chat opens and when the page changes (`popstate`, `hashchange`).
    Only the path is sent, never the query string or hash, which can carry
    tokens or personal data.
- Exposes control methods (init, show, hide, destroy) globally or as module exports

It's pure vanilla JavaScript — no React, no external dependencies, no heavy bundle.
Perfect for embedding on any platform or CMS.

### 🧾 License

Released under the [MIT License](LICENSE).  
[![License: MIT](https://img.shields.io/badge/license-MIT-success.svg?style=flat-square)](LICENSE)

#### 🌟 About ECODrIx

Built and maintained by the ECODrIx Team,
crafting elegant automation tools for modern businesses.

Ready to enhance user engagement? Install the SDK and start chatting with your visitors in minutes! 🚀
