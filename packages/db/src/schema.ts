import { pgTable, text, timestamp, varchar, serial, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { lifecycleDates } from "./util/lifecycle-dates";

export const users = pgTable("users", {
  userId: varchar("user_id", { length: 128 }).primaryKey(),
  // Add more clerk fields you want to sync here
  email: text("email").notNull(),
  ...lifecycleDates,
});

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => users.userId),
  ...lifecycleDates,
}, (table) => {
  return {
    userIdIdx: index("journal_entries_user_id_idx").on(table.userId),
    dateIdx: index("journal_entries_date_idx").on(table.date),
  };
});

export const priorities = pgTable("priorities", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  completed: boolean("completed").default(false).notNull(),
  rank: serial("rank").notNull(),
  journalEntryId: serial("journal_entry_id")
    .references(() => journalEntries.id),
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => users.userId),
  ...lifecycleDates,
}, (table) => {
  return {
    userIdIdx: index("priorities_user_id_idx").on(table.userId),
    dateIdx: index("priorities_date_idx").on(table.date),
  };
});

export const contextEntities = pgTable("context_entities", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // person, role, project, product, strategy
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata"), // Flexible JSON field for additional entity-specific data
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => users.userId),
  ...lifecycleDates,
}, (table) => {
  return {
    userIdIdx: index("context_entities_user_id_idx").on(table.userId),
    typeIdx: index("context_entities_type_idx").on(table.type),
  };
});

export const entityRelationships = pgTable("entity_relationships", {
  id: serial("id").primaryKey(),
  sourceEntityId: serial("source_entity_id")
    .notNull()
    .references(() => contextEntities.id),
  targetEntityId: serial("target_entity_id")
    .notNull()
    .references(() => contextEntities.id),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(), // manages, reports_to, part_of, etc.
  metadata: jsonb("metadata"), // Additional relationship data
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => users.userId),
  ...lifecycleDates,
});

export const clarifyingQuestions = pgTable("clarifying_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, answered, dismissed
  contextEntityId: serial("context_entity_id")
    .references(() => contextEntities.id),
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => users.userId),
  ...lifecycleDates,
});

// Keep the posts table for reference or remove if not needed
export const posts = pgTable("posts", {
  id: varchar("id", { length: 255 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  userId: varchar("user_id", { length: 128 })
    .notNull()
    .references(() => users.userId),
  ...lifecycleDates,
});
