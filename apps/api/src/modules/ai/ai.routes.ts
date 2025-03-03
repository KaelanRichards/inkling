import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { aiService } from "./ai.service";
import { auth, requireAuth, getUserId } from "../../pkg/middleware/clerk-auth";

// For journal entry analysis
const journalEntryIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number)
});

// For clarifying question answers
const answerQuestionSchema = z.object({
  answer: z.string().min(1)
});

export const aiRoutes = new Hono()
  .use(auth(), requireAuth)
  // Analyze a journal entry
  .post("/analyze-entry/:id", zValidator("param", journalEntryIdSchema), async (c) => {
    const userId = getUserId(c);
    const { id } = c.req.valid("param");
    
    try {
      const analysis = await aiService.analyzeJournalEntry(userId, id);
      return c.json(analysis);
    } catch (error) {
      console.error("Error analyzing journal entry:", error);
      return c.json({ error: "Failed to analyze journal entry" }, 500);
    }
  })
  // Generate daily summary and priorities
  .get("/daily-summary", async (c) => {
    const userId = getUserId(c);
    const date = new Date();
    
    try {
      const summary = await aiService.generateDailySummary(userId, date);
      return c.json(summary);
    } catch (error) {
      console.error("Error generating daily summary:", error);
      return c.json({ error: "Failed to generate daily summary" }, 500);
    }
  })
  // Get clarifying questions
  .get("/clarifying-questions", async (c) => {
    const userId = getUserId(c);
    
    try {
      const questions = await aiService.generateClarifyingQuestions(userId);
      return c.json(questions);
    } catch (error) {
      console.error("Error generating clarifying questions:", error);
      return c.json({ error: "Failed to generate clarifying questions" }, 500);
    }
  })
  // Answer a clarifying question
  .post("/answer-question/:id", 
    zValidator("param", journalEntryIdSchema),
    zValidator("json", answerQuestionSchema),
    async (c) => {
      const userId = getUserId(c);
      const { id } = c.req.valid("param");
      const { answer } = c.req.valid("json");
      
      try {
        const result = await aiService.answerClarifyingQuestion(userId, id, answer);
        return c.json(result);
      } catch (error) {
        console.error("Error processing question answer:", error);
        return c.json({ error: "Failed to process question answer" }, 500);
      }
    }
  ); 