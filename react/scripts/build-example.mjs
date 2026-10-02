import { build } from "esbuild";

await build({
  entryPoints: ["example/app.jsx"],
  bundle: true,
  format: "esm",
  splitting: true,
  define: {
    "process.env.NODE_ENV": "\"production\"",
  },
  minify: true,
  loader: {
    ".png": "file",
  },
  outdir: "example/dist",
  entryNames: "app",
  assetNames: "assets/[name]-[hash]",
});
