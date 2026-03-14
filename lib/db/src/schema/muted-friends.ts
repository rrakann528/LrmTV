import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const mutedFriendsTable = pgTable("muted_friends", {
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  friendId: integer("friend_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.userId, t.friendId] }),
]);
