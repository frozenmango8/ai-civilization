import { database, transaction } from "../server/db.js";
import { schema } from "../server/schema.js";
await transaction(database(), async (c) => {
  await c.query("SELECT pg_advisory_xact_lock(4172026)");
  await c.query(schema);
});
console.log("Database schema is ready. Existing worlds were preserved.");
process.exit(0);
