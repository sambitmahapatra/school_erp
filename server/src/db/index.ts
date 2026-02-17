/// <reference path="../sql.js.d.ts" />
import fs from "fs";
import path from "path";
import initSqlJs from "sql.js";
import { config } from "../config";

export type DbStatement = {
  get: (...params: any[]) => any;
  all: (...params: any[]) => any[];
  run: (...params: any[]) => { lastInsertRowid?: number; changes?: number };
};

export type Db = {
  prepare: (sql: string) => DbStatement;
  exec: (sql: string) => void;
  transaction: (fn: () => void) => () => void;
  pragma: (sql: string) => void;
};

let db: any = null;
let initPromise: Promise<Db> | null = null;
let transactionDepth = 0;

function ensureDataDir() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(config.dbPath, Buffer.from(data));
}

function lastInsertId() {
  const result = db.exec("SELECT last_insert_rowid() as id");
  if (!result?.length || !result[0].values?.length) return undefined;
  return result[0].values[0][0] as number;
}

function buildStatement(sql: string): DbStatement {
  const stmt = db.prepare(sql);
  return {
    get: (...params: any[]) => {
      stmt.bind(params);
      const hasRow = stmt.step();
      const row = hasRow ? stmt.getAsObject() : undefined;
      stmt.reset();
      stmt.bind([]);
      return row;
    },
    all: (...params: any[]) => {
      stmt.bind(params);
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.reset();
      stmt.bind([]);
      return rows;
    },
    run: (...params: any[]) => {
      stmt.bind(params);
      stmt.step();
      stmt.reset();
      stmt.bind([]);
      const changes = db.getRowsModified ? db.getRowsModified() : undefined;
      const id = lastInsertId();
      if (transactionDepth === 0) {
        persist();
      }
      return { lastInsertRowid: id, changes };
    }
  };
}

function buildDb(): Db {
  return {
    prepare: (sql: string) => buildStatement(sql),
    exec: (sql: string) => {
      db.exec(sql);
      if (transactionDepth === 0) {
        persist();
      }
    },
    transaction: (fn: () => void) => {
      return () => {
        transactionDepth += 1;
        db.exec("BEGIN");
        try {
          fn();
          db.exec("COMMIT");
        } catch (err) {
          db.exec("ROLLBACK");
          throw err;
        } finally {
          transactionDepth -= 1;
          if (transactionDepth === 0) {
            persist();
          }
        }
      };
    },
    pragma: (sql: string) => {
      db.exec(`PRAGMA ${sql}`);
    }
  };
}

export function getDb(): Db {
  if (!db) {
    throw new Error("Database not initialized. Call initDb first.");
  }
  return buildDb();
}

export async function initDb(): Promise<Db> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    ensureDataDir();
    const SQL = await initSqlJs({
      locateFile: (file: string) => path.resolve(process.cwd(), "node_modules", "sql.js", "dist", file)
    });

    if (fs.existsSync(config.dbPath)) {
      const fileBuffer = fs.readFileSync(config.dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    const schemaCandidates = [
      path.resolve(process.cwd(), "src", "db", "schema.sql"),
      path.resolve(process.cwd(), "dist", "db", "schema.sql")
    ];
    const schemaPath = schemaCandidates.find((p) => fs.existsSync(p));
    if (!schemaPath) {
      throw new Error("schema.sql not found in src/db or dist/db");
    }
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schemaSql);
    persist();

    return buildDb();
  })();

  return initPromise;
}
