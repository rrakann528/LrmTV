import { createServer } from "http";
import app from "./app";
import { initSocketServer } from "./lib/socket";
import { runMigrations } from "@workspace/db";

// ── Startup env checks ─────────────────────────────────────────────────────────
const port = Number(process.env["PORT"]) || 3000;
if (Number.isNaN(port) || port <= 0) {
  console.error(`[server] Invalid PORT value, defaulting to 3000`);
}
console.log(`[env] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
console.log(`[env] JWT_SECRET set: ${!!process.env.JWT_SECRET}`);
console.log(`[env] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
if (!process.env.JWT_SECRET) {
  console.error('[env] ⚠️  JWT_SECRET is NOT set — all authentication will FAIL! Set this in Railway Variables.');
}

const httpServer = createServer(app);
initSocketServer(httpServer);

runMigrations().then(() => {
  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
