import { pool } from "./pool";
import { migrations } from "./migrations";

export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('later_migrations'))");
    await client.query("CREATE TABLE IF NOT EXISTS later_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const migration of migrations) {
      const exists = await client.query("SELECT 1 FROM later_migrations WHERE id = $1", [migration.id]);
      if (exists.rowCount) continue;
      await client.query(migration.sql);
      await client.query("INSERT INTO later_migrations (id) VALUES ($1)", [migration.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate().then(() => pool.end()).catch((error) => { console.error(error); process.exitCode = 1; });
}
