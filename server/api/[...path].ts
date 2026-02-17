import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../src/app";
import { initDb } from "../src/db";

const ready = initDb();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ready;
  return app(req, res);
}
