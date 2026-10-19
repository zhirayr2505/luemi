import { readConfig } from "./config.js";
import { buildApp } from "./app.js";

const config = readConfig();
const app = buildApp(config);
async function start() {
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}
void start();
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void app.close(); });
}
