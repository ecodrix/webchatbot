import { defineConfig } from "tsup";

export default defineConfig([
  // 1. npm package — ESM + CJS for `.` (core) and `./react`. `.d.ts` emitted.
  //    React stays external (optional peer dependency).
  {
    name: "npm",
    entry: { index: "src/index.ts", react: "src/react.ts" },
    format: ["esm", "cjs"],
    outDir: "dist",
    dts: true,
    clean: true,
    minify: true,
    target: "es2019",
    external: ["react"],
  },

  // 2. CDN — single-file, self-contained IIFE for `<script>` embeds. Running it
  //    executes the side effect that attaches `window.ECODrIx`. `globalName` is
  //    a harmless module namespace (NOT `ECODrIx`, to avoid clobbering the
  //    side-effect global). Output: dist/index.global.js.
  {
    name: "cdn",
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "ECODrIxSDK",
    outDir: "dist",
    dts: false,
    clean: false,
    minify: true,
    target: "es2019",
  },
]);
