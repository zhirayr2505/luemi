import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } }
  },
  // Real-only release must not ship separately-addressable demo chat HTML.
  // Local/QA builds retain the preview entry for isolated testing.
  build:{rollupOptions:{input:process.env.VITE_LUEMI_REAL_ONLY==="1"
    ?{app:resolve(__dirname,"index.html")}
    :{app:resolve(__dirname,"index.html"),chatsDemo:resolve(__dirname,"chats-demo.html"),
      registrationV2:resolve(__dirname,"registration-v2-preview.html")}}}
});
