import { randomUUID } from "node:crypto";
import { config } from "../config";
import { migrate } from "../db/migrate";
import { pool } from "../db/pool";
import { reclaimAndClaim } from "../messages/repository";
import { processMessage } from "./processor";

let stopping = false;
const workerId = `${process.pid}:${randomUUID()}`;

async function main() {
  await migrate();
  console.log(`Later worker ${workerId} started`);
  while (!stopping) {
    try {
      const message = await reclaimAndClaim(workerId, config.workerLeaseMs);
      if (message) {
        await processMessage(message, config.workerMaxAttempts);
        continue;
      }
    } catch (error) {
      console.error("Later worker iteration failed", error);
    }
    await delay(config.workerPollIntervalMs);
  }
  await pool.end();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => { stopping = true; });
}

function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

main().catch((error) => { console.error(error); process.exitCode = 1; });
