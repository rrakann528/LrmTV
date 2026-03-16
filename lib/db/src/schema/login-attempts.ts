import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const loginAttemptsTable = pgTable("login_attempts", {
  id: serial("id").primaryKey(),
  identifier: text("identifier").notNull(),
  ip: text("ip").notNull().default(""),
  success: boolean("success").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoginAttempt = typeof loginAttemptsTable.$inferSelect;
