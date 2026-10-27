import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } }
  },
  build:{rollupOptions:{input:{app:resolve(__dirname,"index.html"),chatsDemo:resolve(__dirname,"chats-demo.html")}}}
});
