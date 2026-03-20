import { defineConfig } from "tsup";

export default defineConfig([
  // Core SDK (no React dependency)
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  // Workflow Editor (React components)
  {
    entry: { "workflow-editor": "src/workflow-editor/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    sourcemap: true,
    external: ["react", "react-dom"],
    esbuildOptions(options) {
      options.jsx = "automatic";
    },
  },
]);
