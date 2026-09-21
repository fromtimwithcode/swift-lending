import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
const repo = fileURLToPath(new URL("../../", import.meta.url));
// Reuse the exact Next-generated Latin font instead of substituting different metrics.
const font = readdirSync(`${repo}.next/static/media`).find(
  (name) => name.includes("-s.p.") && name.endsWith(".woff2"),
);
if (!font)
  throw new Error(
    "Run pnpm build before UI tests to generate the application font.",
  );
export default defineConfig({
  plugins: [
    {
      name: "review-font",
      transformIndexHtml: (html) =>
        html.replace(
          "</head>",
          `<style>@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-weight:300 800;src:url('/@fs/${repo}.next/static/media/${font}') format('woff2');font-display:swap}:root{--font-jakarta:'Plus Jakarta Sans'}</style></head>`,
        ),
    },
  ],
  root: fileURLToPath(new URL("./", import.meta.url)),
  resolve: {
    alias: [
      { find: "@", replacement: repo },
      { find: "convex/react", replacement: `${repo}tests/ui/convex-mock.ts` },
      {
        find: "next/navigation",
        replacement: `${repo}tests/ui/navigation-mock.ts`,
      },
      { find: "next/link", replacement: `${repo}tests/ui/link-mock.tsx` },
    ],
  },
  css: { postcss: repo },
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
    fs: { allow: [repo] },
  },
});
