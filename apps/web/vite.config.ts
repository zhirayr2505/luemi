import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {resolve} from "node:path";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } }
  },
  // The public release includes only the real app entry. Never publish the
  // chats-demo HTML entry or load the synthetic Discovery card deck.
  build:{rollupOptions:{input:process.env.VITE_LUEMI_REAL_ONLY==="1"?
   {app:resolve(__dirname,"index.html")}:
   {app:resolve(__dirname,"index.html"),chatsDemo:resolve(__dirname,"chats-demo.html")}}}
});
