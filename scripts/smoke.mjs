import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = 33000 + Math.floor(Math.random() * 15000);
const host = `http://127.0.0.1:${port}`;
const proc = spawn(process.execPath, ["--import", "tsx", "apps/api/src/start.ts"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "ignore", "pipe"]
});
let stderr = "";
proc.stderr.setEncoding("utf8").on("data", data => { stderr += data; });
try {
  let response;
  for (let i = 0; i < 50; i++) {
    if (proc.exitCode !== null) throw new Error(`Server exited ${proc.exitCode}: ${stderr}`);
    try { response = await fetch(`${host}/api/health`); break; }
    catch { await delay(150); }
  }
  if (!response) throw new Error(`Server never started: ${stderr}`);
  if (response.status !== 200) throw new Error(`health: HTTP ${response.status}`);
  const health = await response.json();
  if (health.service !== "luemi" || health.status !== "ok") throw new Error("Incorrect liveness data");
  const readiness = await fetch(`${host}/api/readiness`);
  if (readiness.status !== 503) throw new Error(`Expected readiness=503 before DB, got ${readiness.status}`);
  const page = await fetch(host);
  const html = await page.text();
  if (page.status !== 200 || !html.includes('id="root"')) throw new Error("HTML shell not served");
  console.log("LUEMI smoke OK — liveness 200, readiness 503, HTML 200");
} finally {
  proc.kill("SIGTERM");
}
