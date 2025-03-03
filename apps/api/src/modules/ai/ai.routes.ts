import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { aiService } from "./ai.service";
import { auth, requireAuth, getUserId } from "../../pkg/middleware/clerk-auth";

// For ID params
const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
});

// For date-based queries
const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) // YYYY-MM-DD format
});

// For answering clarifying questions
const answerQuestionSchema = z.object({
  answer: z.string().min(1)
});

export const aiRoutes = new Hono()
  .use(auth(), requireAuth)
  // Analyze a journal entry
  .post("/analyze/:id", zValidator("param", idParamSchema), async (c) => {
    const userId = getUserId(c);
    const { id } = c.req.valid("param");
    
    try {
      const analysis = await aiService.analyzeJournalEntry(userId, id);
      return c.json(analysis);
    } catch (error) {
      return c.json({ error: (error as Error).message }, 404);
    }
  })
  // Generate daily summary
  .get("/summary", zValidator("query", dateQuerySchema), async (c) => {
    const userId = getUserId(c);
    const { date } = c.req.valid("query");
    
    const summary = await aiService.generateDailySummary(userId, new Date(date));
    return c.json(summary);
  })
  // Get clarifying questions
  .get("/questions", async (c) => {
    const userId = getUserId(c);
    
    const questions = await aiService.generateClarifyingQuestions(userId);
    return c.json(questions);
  })
  // Answer a clarifying question
  .post("/questions/:id/answer", 
    zValidator("param", idParamSchema),
    zValidator("json", answerQuestionSchema),
    async (c) => {
      const userId = getUserId(c);
      const { id } = c.req.valid("param");
      const { answer } = c.req.valid("json");
      
      // Update the question with the answer
      const db = await import("@repo/db").then(m => m.db);
      const { clarifyingQuestions, eq, and } = await import("@repo/db");
      
      const results = await db
        .update(clarifyingQuestions)
        .set({ 
          answer,
          status: "answered",
          updatedAt: new Date()
        })
        .where(
          and(
            eq(clarifyingQuestions.id, id),
            eq(clarifyingQuestions.userId, userId)
          )
        )
        .returning();
      
      if (!results.length) {
        return c.json({ error: "Question not found" }, 404);
      }
      
      return c.json(results[0]);
    }
  ); 