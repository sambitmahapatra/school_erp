import { Pool, PoolClient, types } from "pg";

types.setTypeParser(20, (value: string) => Number.parseInt(value, 10));

export type DbStatement = {
  get: (...params: any[]) => Promise<any>;
  all: (...params: any[]) => Promise<any[]>;
  run: (...params: any[]) => Promise<{ lastInsertRowid?: number; changes?: number }>;
};

export type Db = {
  prepare: (sql: string) => DbStatement;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: (db: Db) => Promise<T>) => Promise<T>;
};

let pool: Pool | null = null;
let initPromise: Promise<Db> | null = null;

function normalizeSql(sql: string) {
  let normalized = sql.trim();

  if (/^INSERT\s+OR\s+IGNORE/i.test(normalized)) {
    normalized = normalized.replace(/^INSERT\s+OR\s+IGNORE/i, "INSERT");
    if (!/ON\s+CONFLICT/i.test(normalized)) {
      normalized = `${normalized} ON CONFLICT DO NOTHING`;
    }
  }

  normalized = normalized.replace(/\bIS\s+\?/gi, "IS NOT DISTINCT FROM ?");

  return normalized;
}

function toPgParams(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

async function queryInternal(sql: string, params: any[], client?: PoolClient) {
  const normalized = toPgParams(normalizeSql(sql));
  const runner = client || pool;
  if (!runner) {
    throw new Error("Database not initialized. Call initDb first.");
  }
  const result = await (runner as Pool).query(normalized, params);
  return result.rows;
}

async function runInternal(sql: string, params: any[], client?: PoolClient) {
  let normalized = normalizeSql(sql);
  const isInsert = /^\s*INSERT\b/i.test(normalized);
  const hasReturning = /\bRETURNING\b/i.test(normalized);
  if (isInsert && !hasReturning) {
    normalized = `${normalized} RETURNING id`;
  }
  const finalSql = toPgParams(normalized);
  const runner = client || pool;
  if (!runner) {
    throw new Error("Database not initialized. Call initDb first.");
  }
  const result = await (runner as Pool).query(finalSql, params);
  return {
    lastInsertRowid: result.rows?.[0]?.id,
    changes: result.rowCount ?? 0
  };
}

async function execInternal(sql: string, client?: PoolClient) {
  const runner = client || pool;
  if (!runner) {
    throw new Error("Database not initialized. Call initDb first.");
  }
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await (runner as Pool).query(statement);
  }
}

function buildStatement(sql: string, client?: PoolClient): DbStatement {
  return {
    get: async (...params: any[]) => {
      const rows = await queryInternal(sql, params, client);
      return rows[0];
    },
    all: async (...params: any[]) => {
      return queryInternal(sql, params, client);
    },
    run: async (...params: any[]) => {
      const { lastInsertRowid, changes } = await runInternal(sql, params, client);
      return { lastInsertRowid, changes };
    }
  };
}

function buildDb(client?: PoolClient): Db {
  return {
    prepare: (sql: string) => buildStatement(sql, client),
    exec: async (sql: string) => {
      await execInternal(sql, client);
    },
    transaction: async <T>(fn: (db: Db) => Promise<T>) => {
      if (client) {
        return fn(buildDb(client));
      }
      if (!pool) {
        throw new Error("Database not initialized. Call initDb first.");
      }
      const txClient = await pool.connect();
      try {
        await txClient.query("BEGIN");
        const result = await fn(buildDb(txClient));
        await txClient.query("COMMIT");
        return result;
      } catch (err) {
        await txClient.query("ROLLBACK");
        throw err;
      } finally {
        txClient.release();
      }
    }
  };
}

export function getDb(): Db {
  if (!pool) {
    throw new Error("Database not initialized. Call initDb first.");
  }
  return buildDb();
}

export async function initDb(): Promise<Db> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set.");
    }

    const sslEnabled = String(process.env.DATABASE_SSL || "").toLowerCase();
    pool = new Pool({
      connectionString,
      ssl: sslEnabled === "true" || sslEnabled === "1" ? { rejectUnauthorized: false } : undefined
    });

    await pool.query("SELECT 1");

    return buildDb();
  })();

  return initPromise;
}
