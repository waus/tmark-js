import { build } from "esbuild";

await build({
  entryPoints: ["src/tmark-react.tsx"],
  bundle: true,
  format: "esm",
  packages: "external",
  outfile: "dist/tmark-react.js",
});
