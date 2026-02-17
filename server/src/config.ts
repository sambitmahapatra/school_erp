import path from "path";

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), "data");
const dbPath = process.env.DB_PATH || path.resolve(dataDir, "erp.sqlite");

export const config = {
  port: Number(process.env.PORT || 4000),
  dataDir,
  dbPath
};
