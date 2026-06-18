import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import yaml from "js-yaml";
import fs from "fs";
import path from "path";

const config = yaml.load(
  fs.readFileSync(path.resolve(__dirname, "../backend/config.yaml"), "utf-8")
) as { listen: string; frontend_port?: number };

const backendPort = config.listen.replace(/^:/, "");
const frontendPort = config.frontend_port ?? 5173;
const backend = `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: frontendPort,
    host: '0.0.0.0',
    proxy: {
      "/admin": backend,
      "/v1": backend,
    },
  },
});
