import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { journalService } from "./journal.service";
import { auth, requireAuth, getUserId } from "../../pkg/middleware/clerk-auth";
import { journalEntryInsertSchema } from "@repo/db";

// Create a schema without userId, as we'll get that from auth
const createJournalEntrySchema = journalEntryInsertSchema.omit({ 
  userId: true,
  id: true,
  createdAt: true,
  updatedAt: true
});

// For update operations
const updateJournalEntrySchema = z.object({
  content: z.string().min(1)
});

// For date-based queries
const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
});

// For pagination
const paginationSchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).optional()
});

// For ID params
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
});

export const journalRoutes = new Hono()
  .use(auth(), requireAuth)
  // Get all journal entries with pagination
  .get("/", zValidator("query", paginationSchema), async (c) => {
    const userId = getUserId(c);
    const { limit, offset } = c.req.valid("query");
    const entries = await journalService.getJournalEntries(userId, limit, offset);
    return c.json(entries);
  })
  // Get entries by date
  .get("/by-date", zValidator("query", dateQuerySchema), async (c) => {
    const userId = getUserId(c);
    const { date } = c.req.valid("query");
    const entries = await journalService.getJournalEntriesByDate(userId, new Date(date));
    return c.json(entries);
  })
  // Get a specific entry
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const userId = getUserId(c);
    const { id } = c.req.valid("param");
    const entry = await journalService.getJournalEntryById(id, userId);
    
    if (!entry) {
      return c.json({ error: "Journal entry not found" }, 404);
    }
    
    return c.json(entry);
  })
  // Create a new entry
  .post("/", zValidator("json", createJournalEntrySchema), async (c) => {
    const userId = getUserId(c);
    const data = c.req.valid("json");
    
    const entry = await journalService.createJournalEntry({
      ...data,
      userId
    });
    
    return c.json(entry, 201);
  })
  // Update an entry
  .put("/:id", 
    zValidator("param", idParamSchema),
    zValidator("json", updateJournalEntrySchema), 
    async (c) => {
      const userId = getUserId(c);
      const { id } = c.req.valid("param");
      const { content } = c.req.valid("json");
      
      const updatedEntry = await journalService.updateJournalEntry(id, userId, content);
      
      if (!updatedEntry) {
        return c.json({ error: "Journal entry not found" }, 404);
      }
      
      return c.json(updatedEntry);
    }
  )
  // Delete an entry
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const userId = getUserId(c);
    const { id } = c.req.valid("param");
    
    await journalService.deleteJournalEntry(id, userId);
    
    return c.json({ success: true }, 200);
  }); 