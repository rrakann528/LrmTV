import { pgTable, text, serial, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";

export const playlistItemsTable = pgTable("playlist_items", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sourceType: varchar("source_type", { length: 20 }).notNull().default("other"),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  addedBy: text("added_by"),
});

export const insertPlaylistItemSchema = createInsertSchema(playlistItemsTable).omit({ id: true });
export type InsertPlaylistItem = z.infer<typeof insertPlaylistItemSchema>;
export type PlaylistItem = typeof playlistItemsTable.$inferSelect;
