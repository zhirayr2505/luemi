import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { validateTelegramInitData } from "../src/telegram-auth.js";
import { buildApp } from "../src/app.js";

const token = "123456:local-test-token";
const now = Math.floor(Date.now() / 1000);
function sign(data: Record<string, string>): string {
  const check = Object.entries(data).sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...data, hash }).toString();
}
const data = { auth_date: String(now), user: JSON.stringify({ id: 4321, first_name: "Тест" }) };

test("authenticates valid signed initData", () => {
  assert.equal(validateTelegramInitData(sign(data), token, now)?.user.id, 4321);
});
test("rejects tampering and stale credentials", () => {
  const raw = sign(data);
  assert.equal(validateTelegramInitData(raw.replace("4321", "1111"), token, now), null);
  assert.equal(validateTelegramInitData(raw, token, now + 3601), null);
});
test("rejects duplicate keys", () => {
  assert.equal(validateTelegramInitData(sign(data) + "&auth_date=" + now, token, now), null);
});
test("exposes minimal liveness and protects readiness", async () => {
  const app = buildApp({ port: 3001, origin: "http://localhost:5173", botToken: token, healthKey: "a".repeat(32), logger: false });
  try {
    assert.deepEqual((await app.inject("/api/health/live")).json(), { status: "ok" });
    assert.equal((await app.inject("/api/health/ready")).statusCode, 404);
    assert.equal((await app.inject({ url: "/api/health/ready", headers: { "x-health-key": "a".repeat(32) } })).statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url: "/api/auth/telegram", payload: { initData: sign(data) } })).statusCode, 200);
    assert.equal((await app.inject({ method: "POST", url: "/api/auth/telegram", payload: { initData: "bad" } })).statusCode, 401);
  } finally {
    await app.close();
  }
});
