import express from "express";
import cors from "cors";
import helmet from "helmet";
import routes from "./routes";
import { initDb } from "./db";
import { config } from "./config";
import { errorHandler } from "./middleware/error";

async function start() {
  await initDb();

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/v1", routes);

  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`ERP server listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
