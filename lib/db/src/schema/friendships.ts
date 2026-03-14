import { pgTable, serial, integer, varchar, timestamp, index, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const friendshipsTable = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  addresseeId: integer("addressee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique().on(t.requesterId, t.addresseeId),
  index("idx_friendships_addressee").on(t.addresseeId),
]);

export type Friendship = typeof friendshipsTable.$inferSelect;
