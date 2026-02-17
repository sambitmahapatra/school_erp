import { initDb } from "./db";
import { config } from "./config";
import { createApp } from "./app";

async function start() {
  await initDb();

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`ERP server listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
