import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] WARNING: DATABASE_URL is not set. Database features will not work.",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost/placeholder",
  max: process.env.DATABASE_URL ? 10 : 0,
});

pool.on("error", (err) => {
  console.error("[db] Pool error (non-fatal):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
