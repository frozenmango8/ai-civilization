import pg from "pg";
export interface DBClient {
  query(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: any[]; rowCount?: number | null }>;
  release(): void;
}
export interface Database {
  connect(): Promise<DBClient>;
  query(sql: string, values?: unknown[]): Promise<{ rows: any[] }>;
}
let pool: pg.Pool | undefined;
export function database(): Database {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_NOT_CONFIGURED");
  // Neon connection strings should include sslmode=require. TLS verification stays enabled.
  pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
  });
  return pool;
}
export async function transaction<T>(
  db: Database,
  fn: (client: DBClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
