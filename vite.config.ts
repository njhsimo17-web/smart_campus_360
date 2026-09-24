import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    allowedHosts: [
      "pleasant-forgiveness-production-d041.up.railway.app",
    ],
  },

  preview: {
    host: "0.0.0.0",
    allowedHosts: [
      "pleasant-forgiveness-production-d041.up.railway.app",
    ],
  },
});