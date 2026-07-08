# 🧠 ECODrIx Chatbot SDK

> A **lightweight, dependency-free JavaScript SDK** for embedding the [ECODrIx Chatbot](https://app.ecodrix.com) widget into _any_ website or framework — with elegance, speed, and full customization.

[![npm version](https://img.shields.io/npm/v/ecodrix-sdk.svg?color=4f46e5&style=flat-square)](https://www.npmjs.com/package/@ecodrix/chatbot)
[![license](https://img.shields.io/badge/license-MIT-success.svg?style=flat-square)](LICENSE)
[![build](https://img.shields.io/badge/build-rollup-orange.svg?style=flat-square)](https://rollupjs.org)

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

#### Option 2 — CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@ecodrix/chatbot/dist/index.umd.js"></script>
```

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

#### Global Script (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/@ecodrix/chatbot"></script>

<script>
  ECODrIx.init({
    botUrl: "https://app.ecodrix.com/widget-frame",
    bubbleIcon: "💬",
    bubbleColor: "#4f46e5",
    autoOpen: 8,
  });
</script>
```

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
| **baseUrl**            | `string`                                                       | `"https://app.ecodrix.com"`           | ECODrIx app origin used with `clientCode`                                                           |
| **botUrl**             | `string`                                                       | —                                     | Explicit iframe URL _(advanced; optional when `clientCode` is set)_                                 |
| **onOpen**             | `() => void`                                                   | —                                     | Called when the chat window opens                                                                   |
| **onClose**            | `() => void`                                                   | —                                     | Called when the chat window closes                                                                  |
| **bubbleIcon**         | `string`                                                       | `"💬"`                                | Emoji, SVG string, or image URL                                                                     |
| **bubbleColor**        | `string`                                                       | `"#4f46e5"`                           | Base color for the chat bubble                                                                      |
| **iconColor**          | `string`                                                       | `"#ffffff"`                           | Color for icon inside bubble                                                                        |
| **pulseColor**         | `string`                                                       | `"#34d399"`                           | Pulse/ripple effect color                                                                           |
| **tooltipText**        | `string`                                                       | `"Chat with us!"`                     | Hover tooltip text                                                                                  |
| **tooltipColor**       | `string`                                                       | `"#333333"`                           | Tooltip text color                                                                                  |
| **tooltipBgColor**     | `string`                                                       | `"#ffffff"`                           | Tooltip background color                                                                            |
| **bubbleSize**         | `number`                                                       | `56`                                  | Diameter of bubble in pixels                                                                        |
| **bubblePosition**     | `"bottom-left"`, `"bottom-right"`, `"top-left"`, `"top-right"` | `"bottom-right"`                      | Screen corner position                                                                              |
| **iframeWidth**        | `number`                                                       | `340`                                 | Width of chat iframe                                                                                |
| **iframeHeight**       | `number`                                                       | `500`                                 | Height of chat iframe                                                                               |
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
  botUrl: "https://app.ecodrix.com/widget-frame",
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
      botUrl: "https://app.ecodrix.com/widget-frame",
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
    <script src="https://cdn.jsdelivr.net/npm/@ecodrix/chatbot"></script>
    <script>
      ECODrIx.init({
        botUrl: "https://app.ecodrix.com/widget-frame",
        bubbleIcon: "💬",
        autoOpen: 5,
      });
    </script>
  </body>
</html>
```

#### 🧠 How It Works

Under the hood, the SDK:

Creates a floating bubble button
Preloads the iframe chatbot for instant open
Animates bubble hover + ripple pulse
Handles window resizing & postMessage events for iframe control
Exposes control methods (init, show, hide, destroy) globally or as module exports

It's pure vanilla JavaScript — no React, no external dependencies, no heavy bundle.
Perfect for embedding on any platform or CMS.

### 🧾 License

Released under the [MIT License](LICENSE).  
[![License: MIT](https://img.shields.io/badge/license-MIT-success.svg?style=flat-square)](LICENSE)

#### 🌟 About ECODrIx

Built and maintained by the ECODrIx Team,
crafting elegant automation tools for modern businesses.

Ready to enhance user engagement? Install the SDK and start chatting with your visitors in minutes! 🚀
