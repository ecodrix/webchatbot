// The package installs no test runner (no new dependencies): run with the
// workspace's Vitest + jsdom, from ECOD/saas:
//   npx vitest run --root ../packages/chatbot
// No import from "vitest/config", so it loads from any Vitest install.
export default {
  test: {
    environment: "jsdom",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
};
