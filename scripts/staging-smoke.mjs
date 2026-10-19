import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const port = 20000 + (process.pid % 20000);
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: "apps/api",
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    APP_ORIGIN: "https://luemi-stage01.onrender.com",
    STAGING_BOOTSTRAP_ONLY: "1",
    TELEGRAM_BOT_TOKEN: "",
    TELEGRAM_WEBHOOK_SECRET: "",
    HEALTH_CHECK_KEY: ""
  }
});
let processError = "";
child.stderr.on("data", (buffer) => { processError += String(buffer); });
async function waitUntilReady() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server stopped early: ${processError}`);
    try {
      const response = await fetch(`${origin}/api/health/live`);
      if (response.ok) return;
    } catch {
      // Retry until startup completes.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not listen: ${processError}`);
}
try {
  await waitUntilReady();
  const home = await fetch(origin, { headers: { accept: "text/html" } });
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes("telegram-web-app.js"), "official Telegram SDK must be present");
  assert.ok(html.includes("LUEMI"));
  const asset = await fetch(`${origin}/assets/brand/wordmark_original_raster_alpha_W06.webp`);
  assert.equal(asset.status, 200, "original-wordmark derivative must be served");
  assert.ok((await asset.arrayBuffer()).byteLength > 1000);
  const unauthenticated = await fetch(`${origin}/api/auth/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: "untrusted" })
  });
  assert.equal(unauthenticated.status, 503, "staging must be fail-closed without bot credentials");
  const webhook = await fetch(`${origin}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(webhook.status, 404);
  console.log("STAGING SMOKE PASS: same-origin React HTML + verified raster, API health, disabled auth and blocked webhook.");
} finally {
  child.kill("SIGTERM");
}
