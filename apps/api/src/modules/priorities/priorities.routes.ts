import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prioritiesService } from "./priorities.service";
import { auth, requireAuth, getUserId } from "../../pkg/middleware/clerk-auth";
import { priorityInsertSchema } from "@repo/db";

// Create a schema without userId, as we'll get that from auth
const createPrioritySchema = priorityInsertSchema.omit({ 
  userId: true,
  id: true,
  createdAt: true,
  updatedAt: true
});

// For update operations
const updatePrioritySchema = z.object({
  content: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  rank: z.number().int().positive().optional()
});

// For date-based queries
const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
});

// For ID params
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
});

// For rank updates
const rankUpdateSchema = z.object({
  rank: z.number().int().positive()
});

export const prioritiesRoutes = new Hono()
  .use(auth(), requireAuth)
  // Get all priorities
  .get("/", async (c) => {
    const userId = getUserId(c);
    const priorities = await prioritiesService.getPriorities(userId);
    return c.json(priorities);
  })
  // Get priorities by date
  .get("/by-date", zValidator("query", dateQuerySchema), async (c) => {
    const userId = getUserId(c);
    const { date } = c.req.valid("query");
    const priorities = await prioritiesService.getPrioritiesByDate(userId, new Date(date));
    return c.json(priorities);
  })
  // Get a specific priority
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const userId = getUserId(c);
    const { id } = c.req.valid("param");
    const priority = await prioritiesService.getPriorityById(id, userId);
    
    if (!priority) {
      return c.json({ error: "Priority not found" }, 404);
    }
    
    return c.json(priority);
  })
  // Create a new priority
  .post("/", zValidator("json", createPrioritySchema), async (c) => {
    const userId = getUserId(c);
    const data = c.req.valid("json");
    
    const priority = await prioritiesService.createPriority({
      ...data,
      userId
    });
    
    return c.json(priority, 201);
  })
  // Update a priority
  .put("/:id", 
    zValidator("param", idParamSchema),
    zValidator("json", updatePrioritySchema), 
    async (c) => {
      const userId = getUserId(c);
      const { id } = c.req.valid("param");
      const data = c.req.valid("json");
      
      const updatedPriority = await prioritiesService.updatePriority(id, userId, data);
      
      if (!updatedPriority) {
        return c.json({ error: "Priority not found" }, 404);
      }
      
      return c.json(updatedPriority);
    }
  )
  // Toggle priority completion status
  .put("/:id/toggle", zValidator("param", idParamSchema), async (c) => {
    const userId = getUserId(c);
    const { id } = c.req.valid("param");
    
    const updatedPriority = await prioritiesService.togglePriorityCompletion(id, userId);
    
    if (!updatedPriority) {
      return c.json({ error: "Priority not found" }, 404);
    }
    
    return c.json(updatedPriority);
  })
  // Update priority rank
  .put("/:id/rank", 
    zValidator("param", idParamSchema),
    zValidator("json", rankUpdateSchema), 
    async (c) => {
      const userId = getUserId(c);
      const { id } = c.req.valid("param");
      const { rank } = c.req.valid("json");
      
      const updatedPriority = await prioritiesService.updatePriorityRank(id, userId, rank);
      
      if (!updatedPriority) {
        return c.json({ error: "Priority not found" }, 404);
      }
      
      return c.json(updatedPriority);
    }
  )
  // Delete a priority
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const userId = getUserId(c);
    const { id } = c.req.valid("param");
    
    await prioritiesService.deletePriority(id, userId);
    
    return c.json({ success: true }, 200);
  }); 