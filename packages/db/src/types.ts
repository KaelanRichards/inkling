import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import * as schema from "./schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export type User = InferSelectModel<typeof schema.users>;
export type NewUser = InferInsertModel<typeof schema.users>;

export type Post = InferSelectModel<typeof schema.posts>;
export type NewPost = InferInsertModel<typeof schema.posts>;

export type JournalEntry = InferSelectModel<typeof schema.journalEntries>;
export type NewJournalEntry = InferInsertModel<typeof schema.journalEntries>;

export type Priority = InferSelectModel<typeof schema.priorities>;
export type NewPriority = InferInsertModel<typeof schema.priorities>;

export type ContextEntity = InferSelectModel<typeof schema.contextEntities>;
export type NewContextEntity = InferInsertModel<typeof schema.contextEntities>;

export type EntityRelationship = InferSelectModel<typeof schema.entityRelationships>;
export type NewEntityRelationship = InferInsertModel<typeof schema.entityRelationships>;

export type ClarifyingQuestion = InferSelectModel<typeof schema.clarifyingQuestions>;
export type NewClarifyingQuestion = InferInsertModel<typeof schema.clarifyingQuestions>;

// Zod schemas for validation
export const userInsertSchema = createInsertSchema(schema.users);
export const userSelectSchema = createSelectSchema(schema.users);

export const postInsertSchema = createInsertSchema(schema.posts);
export const postSelectSchema = createSelectSchema(schema.posts);

export const journalEntryInsertSchema = createInsertSchema(schema.journalEntries);
export const journalEntrySelectSchema = createSelectSchema(schema.journalEntries);

export const priorityInsertSchema = createInsertSchema(schema.priorities);
export const prioritySelectSchema = createSelectSchema(schema.priorities);

export const contextEntityInsertSchema = createInsertSchema(schema.contextEntities);
export const contextEntitySelectSchema = createSelectSchema(schema.contextEntities);

export const entityRelationshipInsertSchema = createInsertSchema(schema.entityRelationships);
export const entityRelationshipSelectSchema = createSelectSchema(schema.entityRelationships);

export const clarifyingQuestionInsertSchema = createInsertSchema(schema.clarifyingQuestions);
export const clarifyingQuestionSelectSchema = createSelectSchema(schema.clarifyingQuestions);
