import { createApp } from "./app";
import { config } from "./config";
import { migrate } from "./db/migrate";

migrate()
  .then(() => createApp().listen(config.port, () => console.log(`Later listening on ${config.port}`)))
  .catch((error) => { console.error(error); process.exitCode = 1; });
